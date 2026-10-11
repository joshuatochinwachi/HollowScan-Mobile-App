#!/usr/bin/env python3
"""
HollowScan - Image Backfill & Enrichment Utility
This script scans Supabase for messages that lack valid product images (e.g. Vinted/clothing monitors),
extracts candidate listing URLs, scrapes og:image / JSON-LD high-res product visuals,
and patches the rows in Supabase so the HollowScan Mobile App displays them immediately.

Usage:
    python backfill_images.py [--limit 100] [--days 7]
"""

import os
import re
import sys
import time
import json
import argparse
from typing import Optional, List, Dict, Any, Tuple
from urllib.parse import urlparse, parse_qs
import requests
from dotenv import load_dotenv

# Load environment variables (searches current folder, parent folder, and backend/.env)
dotenv_candidates = [
    os.path.join(os.path.dirname(__file__), 'backend', '.env'),
    os.path.join(os.path.dirname(__file__), '.env'),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', '.env'),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'),
]
for p in dotenv_candidates:
    if os.path.exists(p):
        load_dotenv(p)
        break

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERROR: Missing SUPABASE_URL or SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY in environment.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

SKIP_PATTERNS = [
    'keepa.com', 'ebay.com/sch', 'login', 'cart', 'checkout', 'bugs.zephr',
    '/member/', 'account', 'signin'
]

HEADERS_HTTP = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}


def is_valid_product_image(url: Optional[str]) -> bool:
    """Validate image URL for Mobile App display."""
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if not (u.startswith("http://") or u.startswith("https://")):
        return False
    if u.startswith("data:image"):
        return False
    u_low = u.lower()
    for bad in ["placeholder", "noimage", "no-image", "notfound", "comingsoon", "unavailable", "no-photo", "image-not-available"]:
        if bad in u_low:
            return False

    # Block generic site fallbacks / icons that pass as og:image but are not product photos
    junk_paths = [
        "og_img_discord_home",
        "assets/og_img",
        "avatar-black.png",
        "avatar-white.png",
        "default-avatar",
        "/assets/avatar",
        "discord-mark-black",
        "discord-mark-white",
        "/s-l32.",
        "/s-l48.",
        "/s-l64.",
        "/s-l96.",
        "spinner",
        "loading-placeholder",
        "/blank.",
        "1x1.png",
        "1x1.gif",
        "pixel.gif",
        "pixel.png",
        "spacer.gif",
    ]
    if any(jp in u_low for jp in junk_paths):
        return False

    return True


def optimize_image_url(url: str) -> str:
    """Clean proxy and size limits from image URLs without breaking signed/ephemeral CDN tokens."""
    if not url:
        return url
    try:
        # Unwrap discord proxy URLs (where the actual image URL is encoded in the path)
        if "images-ext-" in url and "discordapp.net" in url:
            # ⚠️ DO NOT unwrap Vinted or signature-tokened URLs!
            # Vinted's CDN rejects unwrapped links without tokens (HTTP 404).
            # Discord's proxy caches and serves them cleanly with HTTP 200.
            if "vinted" not in url.lower() and "%3fs%3d" not in url.lower():
                if "/https/" in url: url = "https://" + url.split("/https/", 1)[1]
                elif "/http/" in url: url = "http://" + url.split("/http/", 1)[1]

        # Amazon full-res un-cropping
        if any(domain in url for domain in ['media-amazon.com', 'images-amazon.com', 'ssl-images-amazon.com']):
            url = re.sub(r'\._[A-Z_]+[0-9]+_\.', '.', url)
            if "?" in url: url = url.split("?")[0]

        # eBay full-res upgrade
        if "ebayimg.com" in url:
            if re.search(r's-l\d+\.', url): url = re.sub(r's-l\d+\.', 's-l1600.', url)
            if "?" in url: url = url.split("?")[0]

        # NOTE: Do NOT strip query params from discordapp.net / media.discordapp.net / cdn.discordapp.com.
        # Discord attachments use signed query params (?ex=...&is=...&hm=...).
        # Stripping them causes 403 Forbidden.
    except Exception:
        pass
    return url


def scrape_og_image(html_text: str) -> Optional[str]:
    """Extract product image from HTML without external dependencies."""
    if not html_text or not isinstance(html_text, str):
        return None
    # 1. OpenGraph / Twitter Image meta tags
    m = re.search(r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE)
    if not m:
        m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\']', html_text, re.IGNORECASE)
    if m:
        u = m.group(1).strip()
        if u.startswith('//'): u = 'https:' + u
        if is_valid_product_image(u): return u
    # 2. JSON-LD "image" field
    m_json = re.search(r'"image"\s*:\s*["\'](https?://[^"\']+)["\']', html_text, re.IGNORECASE)
    if m_json:
        u = m_json.group(1).strip()
        if is_valid_product_image(u): return u
    return None


# Failure reason constants (mirrors backend [IMAGE ENRICH] tags)
REASON_INVALID_URL    = "INVALID_URL"
REASON_SKIP_PATTERN   = "SKIP_PATTERN"
REASON_HTTP_ERROR     = "HTTP_ERROR"
REASON_NO_OG_TAG      = "NO_OG_TAG"
REASON_INVALID_IMAGE  = "INVALID_IMAGE"
REASON_EXCEPTION      = "EXCEPTION"
REASON_ALL_EXHAUSTED  = "ALL_EXHAUSTED"


def resolve_candidate_image(msg_id: Any, candidate_urls: List[str]) -> Tuple[Optional[str], str, List[str]]:
    """
    Try candidate URLs in priority order and scrape product og:image.

    Returns:
        (image_url_or_None, failure_reason, log_lines)
        - image_url_or_None : the found image URL, or None on failure
        - failure_reason    : one of the REASON_* constants (empty string on success)
        - log_lines         : list of per-URL diagnostic strings to print
    """
    logs = []
    attempted = []

    if not candidate_urls:
        logs.append(f"   [IMAGE ENRICH] SKIP {msg_id}: no candidate URLs provided")
        return None, REASON_INVALID_URL, logs

    last_reason = REASON_ALL_EXHAUSTED

    for raw_url in candidate_urls:
        if not raw_url or not isinstance(raw_url, str) or not raw_url.startswith("http"):
            logs.append(f"   [IMAGE ENRICH] SKIP {msg_id}: invalid/empty URL -> {repr(raw_url)[:80]}")
            last_reason = REASON_INVALID_URL
            continue

        if any(x in raw_url.lower() for x in SKIP_PATTERNS):
            logs.append(f"   [IMAGE ENRICH] SKIP {msg_id}: URL matched skip pattern -> {raw_url[:80]}")
            last_reason = REASON_SKIP_PATTERN
            continue

        clean_url = raw_url
        if "u=" in clean_url or "url=" in clean_url:
            try:
                parsed = urlparse(clean_url)
                qs = parse_qs(parsed.query)
                target = qs.get('u', [None])[0] or qs.get('url', [None])[0]
                if target:
                    if not target.startswith('http'): target = 'https://' + target.lstrip('/')
                    clean_url = target
            except Exception:
                pass

        if any(x in clean_url.lower() for x in SKIP_PATTERNS):
            logs.append(f"   [IMAGE ENRICH] SKIP {msg_id}: unwrapped URL matched skip pattern -> {clean_url[:80]}")
            last_reason = REASON_SKIP_PATTERN
            continue

        attempted.append(clean_url[:80])

        try:
            resp = requests.get(clean_url, headers=HEADERS_HTTP, timeout=8.0, allow_redirects=True)
            if resp.status_code != 200:
                logs.append(f"   [IMAGE ENRICH] HTTP {resp.status_code} for {msg_id} -> {clean_url[:80]}")
                last_reason = REASON_HTTP_ERROR
                continue

            found = scrape_og_image(resp.text)
            if not found:
                logs.append(f"   [IMAGE ENRICH] NO OG TAG for {msg_id} -> {clean_url[:80]} (page len={len(resp.text)})")
                last_reason = REASON_NO_OG_TAG
                continue

            if not is_valid_product_image(found):
                logs.append(f"   [IMAGE ENRICH] INVALID IMAGE for {msg_id} -> scraped={found[:80]}")
                last_reason = REASON_INVALID_IMAGE
                continue

            # SUCCESS
            return optimize_image_url(found), "", logs

        except Exception as e:
            logs.append(f"   [IMAGE ENRICH] EXCEPTION for {msg_id} / {clean_url[:50]}: {type(e).__name__}: {e}")
            last_reason = REASON_EXCEPTION
            continue

    # All URLs exhausted
    logs.append(f"   [IMAGE ENRICH] EXHAUSTED {msg_id}: tried {len(attempted)} URL(s) with no result -> {attempted}")
    return None, last_reason, logs


def patch_message_image(msg_id: Any, image_url: str, raw_data: Dict) -> bool:
    """Patch the message raw_data in Supabase with the scraped image."""
    try:
        updated_raw = dict(raw_data) if raw_data else {}
        if "embed" not in updated_raw or not isinstance(updated_raw["embed"], dict):
            updated_raw["embed"] = {}

        updated_raw["embed"]["images"] = [image_url]
        updated_raw["embed"]["image"] = {"url": image_url}
        updated_raw["embed"]["thumbnail"] = {"url": image_url}
        updated_raw["product_image"] = image_url

        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/discord_messages?id=eq.{msg_id}",
            headers=HEADERS,
            json={"raw_data": updated_raw},
            timeout=10
        )
        return resp.status_code in [200, 204]
    except Exception as e:
        print(f"   ⚠️ Patch error for {msg_id}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="HollowScan Image Backfill Utility")
    parser.add_argument("--limit", type=int, default=150, help="Number of recent messages to inspect (default: 150)")
    args = parser.parse_args()

    print("=" * 65)
    print("🚀 HollowScan Mobile App - High-Res Product Image Backfiller")
    print(f"📡 Supabase URL: {SUPABASE_URL}")
    print(f"📦 Inspecting last {args.limit} messages...")
    print("=" * 65)

    # 1. Fetch recent messages
    url = f"{SUPABASE_URL}/rest/v1/discord_messages?select=id,channel_id,raw_data,scraped_at&order=scraped_at.desc&limit={args.limit}"
    resp = requests.get(url, headers=HEADERS, timeout=30)
    if resp.status_code != 200:
        print(f"❌ Failed to fetch messages from Supabase: HTTP {resp.status_code}")
        sys.exit(1)

    messages = resp.json()
    print(f"✅ Retrieved {len(messages)} messages. Scanning for missing images...\n")

    enriched_count     = 0
    already_valid      = 0
    skipped_no_urls    = 0
    failed_http        = 0
    failed_no_og       = 0
    failed_invalid_img = 0
    failed_skip        = 0
    failed_exception   = 0
    failed_patch       = 0

    for idx, msg in enumerate(messages, 1):
        msg_id = msg.get("id")
        raw = msg.get("raw_data") or {}
        embed = raw.get("embed") or {}
        title = embed.get("title") or "Unknown Product"

        # Check existing images (also handles embed.image as dict)
        curr_img = None
        if embed.get("images") and isinstance(embed["images"], list) and len(embed["images"]) > 0:
            curr_img = embed["images"][0]
        elif embed.get("image"):
            curr_img = embed["image"] if isinstance(embed["image"], str) else embed["image"].get("url")
        elif embed.get("thumbnail"):
            curr_img = embed["thumbnail"] if isinstance(embed["thumbnail"], str) else embed["thumbnail"].get("url")
        elif raw.get("product_image"):
            curr_img = raw["product_image"]

        if is_valid_product_image(curr_img):
            already_valid += 1
            continue

        # ── IMAGE MISSING ──────────────────────────────────────────────
        has_embed_imgs = bool(embed.get("images") or embed.get("image") or embed.get("thumbnail"))
        print(f"[{idx}/{len(messages)}] 🔍 msg={msg_id} | '{title[:45]}' | embed_has_imgs={has_embed_imgs} | curr_img={repr(curr_img)[:60]}")

        # Collect candidate product page URLs
        candidates = []
        if embed.get("title_url"):
            candidates.append(embed["title_url"])

        for link in embed.get("links", []):
            u = link.get("url") if isinstance(link, dict) else link
            if u and u.startswith("http") and u not in candidates:
                candidates.append(u)

        # Also check fields for markdown links  [text](url)
        for field in embed.get("fields", []):
            val = field.get("value", "")
            for _, u in re.findall(r'\[([^\]]+)\]\((https?://[^\)]+)\)', val):
                if u not in candidates:
                    candidates.append(u)

        if not candidates:
            skipped_no_urls += 1
            print(f"   ⏭️  SKIP: No URLs found in embed for this message\n")
            continue

        print(f"   🌐 Trying {len(candidates)} candidate URL(s)...")
        found_image, failure_reason, log_lines = resolve_candidate_image(msg_id, candidates)

        # Print per-URL diagnostic logs
        for line in log_lines:
            print(line)

        if found_image:
            ok = patch_message_image(msg_id, found_image, raw)
            if ok:
                enriched_count += 1
                print(f"   ✅ SUCCESS -> Patched with: {found_image[:70]}\n")
            else:
                failed_patch += 1
                print(f"   ⚠️  Found image but Supabase PATCH failed.\n")
        else:
            if failure_reason == REASON_HTTP_ERROR:      failed_http += 1
            elif failure_reason == REASON_NO_OG_TAG:     failed_no_og += 1
            elif failure_reason == REASON_INVALID_IMAGE: failed_invalid_img += 1
            elif failure_reason == REASON_SKIP_PATTERN:  failed_skip += 1
            elif failure_reason == REASON_EXCEPTION:     failed_exception += 1
            elif failure_reason == REASON_INVALID_URL:   skipped_no_urls += 1
            else:                                        failed_no_og += 1
            print(f"   ❌ NO IMAGE FOUND  reason={failure_reason}\n")

        # Respectful throttle
        time.sleep(0.3)

    print("\n" + "=" * 65)
    print("🎉 BACKFILL COMPLETED SUMMARY:")
    print(f"   - Total messages inspected:      {len(messages)}")
    print(f"   - Already had valid images:       {already_valid}")
    print(f"   - Successfully enriched:          {enriched_count} 📸")
    print(f"   - Skipped (no URLs in embed):     {skipped_no_urls}")
    print(f"   - Failed - HTTP error (blocked):  {failed_http}")
    print(f"   - Failed - No OG tag in page:     {failed_no_og}")
    print(f"   - Failed - OG image was junk:     {failed_invalid_img}")
    print(f"   - Failed - Skip pattern (cart…):  {failed_skip}")
    print(f"   - Failed - Network exception:     {failed_exception}")
    print(f"   - Failed - Supabase PATCH error:  {failed_patch}")
    print("=" * 65)


if __name__ == "__main__":
    main()
