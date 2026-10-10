# HollowScan Image Architecture 

This document details the professional, self-healing image sourcing pipeline for the HollowScan mobile application.

## 1. The Core Logic Flow
The app uses a quad-lock hierarchy to ensure that **no product ever appears without a high-quality image.**

```mermaid
graph TD
    A[Start: Product Render] --> B{Primary image URL exists?}
    B -- Yes --> C[Run Smart Filter: Base64 & Keywords]
    B -- No --> D{Thumbnail URL exists?}
    
    C -- Rejected --> D
    C -- Accepted --> E[Attempt Load URL]
    
    E -- 404 / Error --> D
    E -- Dimensions < 60px --> D
    E -- Success --> F[Display Primary Visual]
    
    D -- Yes --> G[Run Smart Filter on Thumbnail]
    D -- No --> H[FINAL LOCK: Serve Branded Fallback]
    
    G -- Rejected --> H
    G -- Accepted --> I[Attempt Load Thumbnail]
    
    I -- 404 / Error --> H
    I -- Dimensions < 60px --> H
    I -- Success --> J[Display Thumbnail Visual]
    
    H --> K[Display Boss-Approved Fallback]
```

After the small fix made on October 10th, 2026, the image architecture now includes a backup scraping system. If the app can't find an image, it will scrape the product page for an image and patch the database with the found image. This is done asynchronously so it doesn't block the UI. The admin can also manually trigger this system for a list of messages using the `/v1/admin/enrich-images` endpoint. This is really useful for links scraped from product pages like Smyths or Argos. If it finds a new image, it will update the database and the next time you pull down to refresh, you'll see the new image.   

```mermaid
sequenceDiagram
    autonumber
    actor Discord as Discord Channel
    participant Scraper as Scraper (Playwright)
    participant TG as Telegram Bot
    participant DB as Supabase (discord_messages)
    participant API as Backend API (/v1/feed)
    participant App as HollowScan Mobile App

    Discord->>Scraper: New Drop (Lazy Image or No Image)
    Scraper->>Scraper: Checks parent <a>, extracts title_url, scrapes og:image if needed
    Scraper->>DB: Stores message with valid high-res image
    DB->>TG: TG Bot processes drop
    TG->>TG: Resolves high-res photo for alert
    TG-->>DB: [NEW] Auto-syncs resolved image back to Supabase in background
    App->>API: GET /v1/feed
    API->>API: 8-Step Image Extraction & Validation
    alt Image is still missing in DB
        API->>DB: [NEW] Background task scrapes og:image via candidate URLs & patches DB
    end
    API->>App: Sends valid image URL
    App->>App: Displays real product visual without fallback card
```

## 2. Technical Implementation Details

### A. The "Smart Filter" Engine
To maintain a premium aesthetic, we use a frontend-driven filter to block low-quality artifacts from retailers (especially Smyths and Argos).

1. **Base64 Blocking**: Automatically rejects URLs starting with `data:image`. This permanently eliminates the common "Next.js blurry gradients" often captured by scrapers.
2. **Keyword Filtering**: Rejects URLs containing confirmed junk strings:
   - `placeholder`, `noimage`, `notfound`, `comingsoon`, `unavailable`, `no-photo`.
   - *Note: We intentionally allow `default`, `blur`, and `pixel` to avoid blocking legitimate high-res links from brands like Nike.*

### B. Physical Dimension Enforcement
Even if a URL passes the filter, the image may still be a tiny, stretched placeholder. 

- **Check**: In the `onLoad` event of the `Image` component, we measure the physical pixels.
- **Threshold**: Any image with `width < 60` or `height < 60` is rejected. 
- **Rationale**: A real product image or thumbnail is always at least 150px. Microscopic placeholders are typically 8px to 32px.

### C. The "Zero-Failure" Fallback
To prevent Android build failures (AAPT compilation errors), we avoid using local image assets for placeholders. Instead, we use a **Permanent GitHub Raw URL**.

- **Source File**: `public/no_image.png` (Root directory)
- **Code Reference**: `FALLBACK_IMAGE_URL` from `../constants/Assets.js`
- **URL**: `https://raw.githubusercontent.com/joshuatochinwachi/HollowScan-Mobile-App/main/public/no_image.png`

## 3. List Recycling Hardening
In `HomeScreen` and `SavedScreen`, we use `useEffect` to reset the `imageError` state whenever a card is reused for a new product.

```javascript
// Prevents recycled cards from showing errors from the previous item
useEffect(() => {
    setImageError(false);
}, [item.id]);
```

## 4. Visual Standards
- **Scaling**: All images (Real or Fallback) use `resizeMode="contain"`.
- **Clipping**: ZERO clipping. The full product is always visible.
- **Symmetry**: Fallback images are centered within the white card containers.
