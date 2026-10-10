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
from typing import Optional, List, Dict, Any
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
    return True


def optimize_image_url(url: str) -> str:
    """Clean proxy and size limits from image URLs."""
    if not url:
        return url
    try:
        if "images-ext-" in url and "discordapp.net" in url:
            if "/https/" in url: url = "https://" + url.split("/https/", 1)[1]
            elif "/http/" in url: url = "http://" + url.split("/http/", 1)[1]
        if any(domain in url for domain in ['media-amazon.com', 'images-amazon.com', 'ssl-images-amazon.com']):
            url = re.sub(r'\._[A-Z_]+[0-9]+_\.', '.', url)
            if "?" in url: url = url.split("?")[0]
        if "ebayimg.com" in url:
            if re.search(r's-l\d+\.', url): url = re.sub(r's-l\d+\.', 's-l1600.', url)
            if "?" in url: url = url.split("?")[0]
        if "discordapp.net" in url and "?" in url: url = url.split("?")[0]
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


def resolve_candidate_image(candidate_urls: List[str]) -> Optional[str]:
    """Try candidate URLs in priority order and scrape product og:image."""
    for raw_url in candidate_urls:
        if not raw_url or not isinstance(raw_url, str) or not raw_url.startswith("http"):
            continue
        if any(x in raw_url.lower() for x in SKIP_PATTERNS):
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
            continue

        try:
            resp = requests.get(clean_url, headers=HEADERS_HTTP, timeout=8.0, allow_redirects=True)
            if resp.status_code == 200:
                found = scrape_og_image(resp.text)
                if found and is_valid_product_image(found):
                    return optimize_image_url(found)
        except Exception as e:
            continue

    return None


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

    enriched_count = 0
    already_valid = 0
    skipped_no_urls = 0
    failed_to_scrape = 0

    for idx, msg in enumerate(messages, 1):
        msg_id = msg.get("id")
        raw = msg.get("raw_data") or {}
        embed = raw.get("embed") or {}
        title = embed.get("title") or "Unknown Product"

        # Check existing images
        curr_img = None
        if embed.get("images") and isinstance(embed["images"], list) and len(embed["images"]) > 0:
            curr_img = embed["images"][0]
        elif embed.get("thumbnail"):
            curr_img = embed["thumbnail"] if isinstance(embed["thumbnail"], str) else embed["thumbnail"].get("url")
        elif raw.get("product_image"):
            curr_img = raw["product_image"]

        if is_valid_product_image(curr_img):
            already_valid += 1
            continue

        # Missing or invalid image - collect candidates
        candidates = []
        if embed.get("title_url"):
            candidates.append(embed["title_url"])

        for link in embed.get("links", []):
            u = link.get("url") if isinstance(link, dict) else link
            if u and u.startswith("http") and u not in candidates:
                candidates.append(u)

        if not candidates:
            skipped_no_urls += 1
            continue

        print(f"[{idx}/{len(messages)}] 🔍 Enriching msg {msg_id}: '{title[:40]}' ({len(candidates)} URLs)...")
        found_image = resolve_candidate_image(candidates)

        if found_image:
            ok = patch_message_image(msg_id, found_image, raw)
            if ok:
                enriched_count += 1
                print(f"   ✅ SUCCESS -> Patched with: {found_image[:70]}")
            else:
                failed_to_scrape += 1
                print(f"   ⚠️ Found image but Supabase patch failed.")
        else:
            failed_to_scrape += 1
            print(f"   ⏭️ No high-res og:image found on product pages.")

        # Respectful throttle
        time.sleep(0.3)

    print("\n" + "=" * 65)
    print("🎉 BACKFILL COMPLETED SUMMARY:")
    print(f"   - Total messages inspected: {len(messages)}")
    print(f"   - Already had valid images:  {already_valid}")
    print(f"   - Successfully enriched:     {enriched_count} 📸")
    print(f"   - Skipped (no URLs found):   {skipped_no_urls}")
    print(f"   - Unresolvable:              {failed_to_scrape}")
    print("=" * 65)


if __name__ == "__main__":
    main()
