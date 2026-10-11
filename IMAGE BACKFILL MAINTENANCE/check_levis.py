import os, json, requests
from dotenv import load_dotenv

load_dotenv("backend/.env")
url = os.getenv("SUPABASE_URL", "").rstrip("/")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")
headers = {"apikey": key, "Authorization": f"Bearer {key}"}

# Query recent messages
r = requests.get(f"{url}/rest/v1/discord_messages?select=id,channel_id,content,raw_data,created_at&order=created_at.desc&limit=60", headers=headers)
if r.status_code == 200:
    items = r.json()
    print(f"Total fetched: {len(items)}")
    for item in items:
        raw = item.get("raw_data") or {}
        title = raw.get("title") or ""
        embeds = raw.get("embeds") or []
        embed_title = embeds[0].get("title", "") if embeds else ""
        content = item.get("content") or ""
        full_text = f"{title} {embed_title} {content}"
        if "Levi" in full_text or "Jeans" in full_text:
            print("--- FOUND ITEM ---")
            print("ID:", item.get("id"))
            print("Channel:", item.get("channel_id"))
            print("Title:", title or embed_title)
            print("Image in raw_data:", raw.get("image"))
            print("Thumbnail in raw_data:", raw.get("thumbnail"))
            if embeds:
                print("Embed image:", embeds[0].get("image"))
                print("Embed thumbnail:", embeds[0].get("thumbnail"))
            print("Full raw_data:")
            print(json.dumps(raw, indent=2))
            break
else:
    print("Error:", r.status_code, r.text)
