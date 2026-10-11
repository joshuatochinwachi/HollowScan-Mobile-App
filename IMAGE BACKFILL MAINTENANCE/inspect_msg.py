import os
import json
import re
import requests
from dotenv import load_dotenv

# Load environment variables robustly
dotenv_candidates = [
    os.path.join(os.path.dirname(__file__), 'backend', '.env'),
    os.path.join(os.path.dirname(__file__), '.env'),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', '.env'),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'),
    os.path.join(os.getcwd(), 'backend', '.env'),
]
for p in dotenv_candidates:
    if os.path.exists(p):
        load_dotenv(p)
        break

url = os.getenv("SUPABASE_URL", "").rstrip("/")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

if not url or not key:
    print("Missing SUPABASE_URL or SUPABASE_KEY in environment (.env).")
    exit(1)

headers = {"apikey": key, "Authorization": f"Bearer {key}"}

# Replicated logic from backend/app.py

def is_valid_product_image(u):
    if not u or not isinstance(u, str): return False
    u = u.strip()
    if not (u.startswith("http://") or u.startswith("https://")): return False
    if u.startswith("data:image"): return False
    u_low = u.lower()
    for bad in ["placeholder", "noimage", "no-image", "notfound", "comingsoon", "coming-soon",
                "unavailable", "no-photo", "image-not-available"]:
        if bad in u_low: return False
    junk_paths = [
        "og_img_discord_home", "assets/og_img", "avatar-black.png", "avatar-white.png",
        "default-avatar", "/assets/avatar", "discord-mark-black", "discord-mark-white",
        "discord-mark-blue", "discord_logo", "/s-l32.", "/s-l48.", "/s-l64.", "/s-l96.",
        "spinner", "loading-placeholder", "/blank.", "1x1.png", "1x1.gif",
        "pixel.gif", "pixel.png", "spacer.gif"
    ]
    for junk in junk_paths:
        if junk in u_low: return False
    return True


def optimize_image_url(u):
    if not u: return u
    try:
        if "images-ext-" in u and "discordapp.net" in u:
            if "vinted" not in u.lower() and "%3fs%3d" not in u.lower():
                if "/https/" in u: u = "https://" + u.split("/https/", 1)[1]
                elif "/http/" in u: u = "http://" + u.split("/http/", 1)[1]
        if any(domain in u for domain in ['media-amazon.com', 'images-amazon.com', 'ssl-images-amazon.com']):
            u = re.sub(r'\._[A-Z_]+[0-9]+_\.', '.', u)
            if "?" in u: u = u.split("?")[0]
        if "ebayimg.com" in u:
            if re.search(r's-l\d+\.', u): u = re.sub(r's-l\d+\.', 's-l1600.', u)
            if "?" in u: u = u.split("?")[0]
    except: pass
    return u


def simulate_extract_image(embed, raw):
    """Simulate extract_product image logic. Returns (image_url_or_None, reason_string)"""
    # 1. embed["images"] list
    if embed.get("images") and isinstance(embed["images"], list):
        for img_c in embed["images"]:
            opt = optimize_image_url(img_c)
            if is_valid_product_image(opt):
                return opt, "OK from embed[images]"
        # list exists but all entries failed
        sample = repr(embed["images"][0])[:120] if embed["images"] else "empty"
        return None, f"embed[images] list EXISTS but all entries failed is_valid. Sample: {sample}"

    # 2. embed["image"]
    if embed.get("image"):
        raw_val = embed["image"]
        img_val = raw_val.get("url") if isinstance(raw_val, dict) else raw_val
        opt = optimize_image_url(img_val)
        if is_valid_product_image(opt):
            return opt, "OK from embed[image]"
        keys_info = list(raw_val.keys()) if isinstance(raw_val, dict) else "string"
        return None, f"embed[image] PRESENT but FAILED -- type={type(raw_val).__name__}, keys={keys_info}, url={repr(str(img_val))[:120]}"

    # 3. embed["thumbnail"]
    if embed.get("thumbnail"):
        raw_val = embed["thumbnail"]
        thumb_val = raw_val.get("url") if isinstance(raw_val, dict) else raw_val
        opt = optimize_image_url(thumb_val)
        if is_valid_product_image(opt):
            return opt, "OK from embed[thumbnail]"
        keys_info = list(raw_val.keys()) if isinstance(raw_val, dict) else "string"
        return None, f"embed[thumbnail] PRESENT but FAILED -- type={type(raw_val).__name__}, keys={keys_info}, url={repr(str(thumb_val))[:120]}"

    # 4. raw top-level keys
    for k in ["product_image", "resolved_image_url", "image_url"]:
        if raw.get(k) and is_valid_product_image(raw[k]):
            return optimize_image_url(raw[k]), f"OK from raw[{k}]"

    return None, "ALL CHECKS FAILED -- no usable image URL found in any field"


print("=" * 65)
print("HollowScan -- Category 2 Diagnostic (embed_has_imgs=True BUT image fails)")
print(f"Querying Supabase: {url}")
print("=" * 65)
print()
print("Scanning last 2000 messages for embed_has_imgs=True failures...")
print("These are products that HAVE images in DB but our code cannot resolve them")
print()

failures_found = 0
MAX_FAILURES = 5

for offset in range(0, 2000, 200):
    query_url = (
        f"{url}/rest/v1/discord_messages"
        f"?select=id,channel_id,content,raw_data,scraped_at"
        f"&order=scraped_at.desc&limit=200&offset={offset}"
    )
    r = requests.get(query_url, headers=headers, timeout=15)
    if r.status_code != 200:
        print(f"HTTP {r.status_code}: {r.text[:100]}")
        break

    batch = r.json()
    if not batch:
        print("Reached end of messages.")
        break

    for item in batch:
        raw = item.get("raw_data") or {}
        embed = raw.get("embed") or (raw.get("embeds") or [{}])[0]

        has_embed_imgs = bool(embed.get("images") or embed.get("image") or embed.get("thumbnail"))
        if not has_embed_imgs:
            continue

        title = embed.get("title") or raw.get("title") or item.get("content") or "Unknown"
        msg_id = item.get("id")

        resolved_image, reason = simulate_extract_image(embed, raw)

        if resolved_image:
            continue  # This one resolves fine -- skip

        failures_found += 1
        print(f"{'='*65}")
        print(f"FAILURE #{failures_found}  msg={msg_id}")
        print(f"  Title:   {str(title)[:60]}")
        print(f"  Scraped: {item.get('scraped_at')}")
        print(f"  Reason:  {reason}")
        print()
        print(f"  embed['image']     = {json.dumps(embed.get('image'))}")
        print(f"  embed['thumbnail'] = {json.dumps(embed.get('thumbnail'))}")
        print(f"  embed['images']    = {json.dumps(embed.get('images'))}")
        print(f"  raw['product_image'] = {repr(raw.get('product_image'))}")
        print()

        # Find any URL to HTTP-test
        test_url = None
        img_field = embed.get("image")
        thumb_field = embed.get("thumbnail")
        if isinstance(img_field, dict):
            test_url = img_field.get("url") or img_field.get("proxy_url")
        elif isinstance(img_field, str):
            test_url = img_field
        if not test_url:
            if isinstance(thumb_field, dict):
                test_url = thumb_field.get("url") or thumb_field.get("proxy_url")
            elif isinstance(thumb_field, str):
                test_url = thumb_field

        if test_url:
            opt = optimize_image_url(test_url)
            print(f"  Testing URL:  {test_url[:90]}")
            print(f"  Optimized:    {opt[:90]}")
            try:
                resp = requests.get(
                    test_url,
                    headers={"User-Agent": "HollowScan/1.0.0 (Mobile; Android)"},
                    timeout=8,
                    allow_redirects=True
                )
                print(f"  HTTP Status:  {resp.status_code}  |  Content-Type: {resp.headers.get('Content-Type')}  |  Size: {len(resp.content)} bytes")
            except Exception as e:
                print(f"  Fetch FAILED: {type(e).__name__}: {e}")
        else:
            print(f"  WARNING: Could not find any URL to test from embed fields.")
        print()

        if failures_found >= MAX_FAILURES:
            break

    if failures_found >= MAX_FAILURES:
        break

print("=" * 65)
if failures_found == 0:
    print("No embed_has_imgs=True failures found in the last 2000 messages!")
    print("All products with embed image data are being resolved correctly.")
else:
    print(f"Found {failures_found} Category 2 failure(s). Review the output above.")
    print("Key things to look for:")
    print("  - embed[image] dict has 'proxy_url' but no 'url' key")
    print("  - URL contains a placeholder/junk keyword our filter blocks")
    print("  - Discord CDN URL has expired (?ex=... params)")
print("=" * 65)





    query_url = f"{url}/rest/v1/discord_messages?select=id,channel_id,content,raw_data,scraped_at&order=scraped_at.desc&limit=200&offset={offset}"
    r = requests.get(query_url, headers=headers, timeout=15)
    if r.status_code != 200:
        print(f"❌ Failed to fetch messages: HTTP {r.status_code} {r.text[:100]}")
        break

    batch = r.json()
    if not batch:
        break

    for item in batch:
        raw = item.get("raw_data") or {}
        embed = raw.get("embed") or (raw.get("embeds") or [{}])[0]
        title = embed.get("title") or raw.get("title") or item.get("content") or ""
        desc = embed.get("description") or ""
        full_text = f"{title} {desc} {item.get('content') or ''}".lower()

        if any(kw in full_text for kw in ["animal crossing", "caravan", "garden shop", "lego cmf", "carhart", "jorts", "levi"]):
            target_item = item
            break

    if target_item:
        break

if not target_item:
    print("❌ Could not find specific keywords in the last 1000 messages.")
    print("   Trying broader search for 'lego'...")
    for offset in range(0, 600, 200):
        query_url = f"{url}/rest/v1/discord_messages?select=id,channel_id,content,raw_data,scraped_at&order=scraped_at.desc&limit=200&offset={offset}"
        r = requests.get(query_url, headers=headers, timeout=15)
        if r.status_code == 200:
            for item in r.json():
                raw = item.get("raw_data") or {}
                embed = raw.get("embed") or (raw.get("embeds") or [{}])[0]
                title = embed.get("title") or raw.get("title") or item.get("content") or ""
                if "lego" in title.lower():
                    target_item = item
                    break
        if target_item:
            break

if not target_item:
    print("❌ Still not found. Please verify if the message exists in the database.")
    exit(0)

msg_id = target_item.get("id")
raw = target_item.get("raw_data") or {}
embed = raw.get("embed") or (raw.get("embeds") or [{}])[0]
title = embed.get("title") or raw.get("title") or target_item.get("content") or "Unknown"

print("\n" + "=" * 65)
print(f"🎯 FOUND TARGET PRODUCT:")
print(f"   ID:         {msg_id}")
print(f"   Title:      {title}")
print(f"   Channel:    {target_item.get('channel_id')}")
print(f"   Scraped at: {target_item.get('scraped_at')}")
print("=" * 65)

print("\n📦 EMBED DATA IN SUPABASE:")
print(f"   • embed['title_url']: {embed.get('title_url')}")
print(f"   • embed['image']:     {embed.get('image')}")
print(f"   • embed['thumbnail']: {embed.get('thumbnail')}")
print(f"   • embed['images']:    {embed.get('images')}")
print(f"   • raw['product_image']: {raw.get('product_image')}")
print(f"   • Links count:        {len(embed.get('links', []))}")
for l in embed.get('links', []):
    print(f"       - {l}")

# Collect all potential image URLs in the row
img_candidates = []
if embed.get("images"):
    for img in embed["images"]:
        if isinstance(img, str) and img not in img_candidates:
            img_candidates.append(img)
if embed.get("image"):
    u = embed["image"] if isinstance(embed["image"], str) else embed["image"].get("url")
    if u and u not in img_candidates:
        img_candidates.append(u)
if embed.get("thumbnail"):
    u = embed["thumbnail"] if isinstance(embed["thumbnail"], str) else embed["thumbnail"].get("url")
    if u and u not in img_candidates:
        img_candidates.append(u)
if raw.get("product_image"):
    u = raw["product_image"]
    if u and u not in img_candidates:
        img_candidates.append(u)

def is_valid_product_image(url):
    if not url or not isinstance(url, str): return False
    u = url.strip()
    if not (u.startswith("http://") or u.startswith("https://")): return False
    if u.startswith("data:image"): return False
    u_low = u.lower()
    for bad in ["placeholder", "noimage", "no-image", "notfound", "comingsoon", "coming-soon", "unavailable", "no-photo", "image-not-available"]:
        if bad in u_low: return False
    junk_paths = [
        "og_img_discord_home", "assets/og_img", "avatar-black.png", "avatar-white.png",
        "default-avatar", "/assets/avatar", "discord-mark-black", "discord-mark-white",
        "discord-mark-blue", "discord_logo", "/s-l32.", "/s-l48.", "/s-l64.", "/s-l96.",
        "spinner", "loading-placeholder", "/blank.", "1x1.png", "1x1.gif", "pixel.gif", "pixel.png", "spacer.gif"
    ]
    for junk in junk_paths:
        if junk in u_low: return False
    return True

def optimize_image_url(url):
    if not url: return url
    try:
        if "images-ext-" in url and "discordapp.net" in url:
            if "vinted" not in url.lower() and "%3fs%3d" not in url.lower():
                if "/https/" in url: url = "https://" + url.split("/https/", 1)[1]
                elif "/http/" in url: url = "http://" + url.split("/http/", 1)[1]
        if any(domain in url for domain in ['media-amazon.com', 'images-amazon.com', 'ssl-images-amazon.com']):
            url = re.sub(r'\._[A-Z_]+[0-9]+_\.', '.', url)
            if "?" in url: url = url.split("?")[0]
        if "ebayimg.com" in url:
            if re.search(r's-l\d+\.', url): url = re.sub(r's-l\d+\.', 's-l1600.', url)
            if "?" in url: url = url.split("?")[0]
    except: pass
    return url

print(f"\n📸 FOUND {len(img_candidates)} IMAGE CANDIDATE(S) IN DB:")
for idx, img_url in enumerate(img_candidates, 1):
    print(f"\n--- Candidate #{idx}: {img_url} ---")
    
    opt_url = optimize_image_url(img_url)
    valid_raw = is_valid_product_image(img_url)
    valid_opt = is_valid_product_image(opt_url)
    print(f"   Optimized URL: {opt_url}")
    print(f"   is_valid_product_image(raw): {valid_raw}")
    print(f"   is_valid_product_image(optimized): {valid_opt}")

    # Test 1: Fetch RAW Discord Proxy URL (as Mobile Phone)
    print("   🌐 Test 1: Fetching RAW Discord Proxy URL (Mobile Phone headers)...")
    try:
        r_raw = requests.get(img_url, headers={"User-Agent": "HollowScan/1.0.0 (Mobile; Android)"}, timeout=8)
        print(f"      RAW Discord Proxy Status: HTTP {r_raw.status_code}")
        print(f"      Content-Type: {r_raw.headers.get('Content-Type')}")
        print(f"      Content-Length: {len(r_raw.content)} bytes")
    except Exception as e:
        print(f"      ❌ RAW Fetch Failed: {type(e).__name__}: {e}")

    # Test 2: Fetch Optimized URL (What the backend currently produces)
    print("   🌐 Test 2: Fetching Current Optimized URL...")
    try:
        r_opt = requests.get(opt_url, headers={"User-Agent": "HollowScan/1.0.0 (Mobile; Android)"}, timeout=8)
        print(f"      Optimized URL Status: HTTP {r_opt.status_code}")
    except Exception as e:
        print(f"      ❌ Optimized Fetch Failed: {type(e).__name__}: {e}")

    # Test 3: Properly restore Vinted Signature if present in proxy path
    import urllib.parse
    restored_url = opt_url
    if "%3Fs%3D" in img_url or "/?s=" in img_url:
        m = re.search(r'%3Fs%3D([a-f0-9]+)', img_url, re.IGNORECASE)
        if m:
            sig = m.group(1)
            sep = "&" if "?" in restored_url else "?"
            restored_url = f"{restored_url}{sep}s={sig}"
            print(f"   🌐 Test 3: Testing with Restored Vinted Signature: {restored_url[:80]}...")
            try:
                r_restored = requests.get(restored_url, headers={"User-Agent": "HollowScan/1.0.0 (Mobile; Android)"}, timeout=8)
                print(f"      Restored Signature Status: HTTP {r_restored.status_code}")
                print(f"      Content-Length: {len(r_restored.content)} bytes")
            except Exception as e:
                print(f"      ❌ Restored Signature Fetch Failed: {type(e).__name__}: {e}")

print("\n" + "=" * 65)
print("🏁 Diagnostic complete. Please review the output above!")
print("=" * 65)
