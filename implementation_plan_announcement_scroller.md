# Implementation Plan: Remote Announcement Scroller

This plan outlines the steps to add a professional announcement banner/scroller to the HollowScan Home Screen, controllable via a backend environment variable.

## User Review Required

> [!IMPORTANT]
> - I will use a **Horizontal Ticker (Marquee style)** for the message, which feels very professional for "live" updates.
> - The message will be defined in a **Backend Environment Variable** (`APP_ANNOUNCEMENT`).
> - The app will fetch this message on every launch/refresh. If it's empty, the banner disappears completely.

## Proposed Changes

### 1. Backend: FastAPI Config ([app.py](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py))
- **[MODIFY]** Add a new environment variable `APP_ANNOUNCEMENT` and an endpoint `/v1/config/announcement` that returns this string.
- This ensures zero database load and maximum flexibility.

### 2. Mobile App: New Component (`components/AnnouncementBanner.js`)
- **[NEW]** Create a `AnnouncementBanner` component using `Animated` for smooth horizontal scrolling.
- **[Logic]** Implement a simple parser to find `[Text](URL)` patterns and render them as clickable blue links within the ticker.

### 3. Mobile App: Integration ([screens/HomeScreen.js](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/screens/HomeScreen.js))
- **[MODIFY]** Fetch the announcement in [fetchInitialData](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/screens/HomeScreen.js#255-271).
- **[MODIFY]** Render the `AnnouncementBanner` just above the deal feed but below the header.

## Verification Plan

### Automated Tests
- No automated UI tests exist for this project yet.

### Manual Verification
1.  **Empty Check:** Set `APP_ANNOUNCEMENT=""` on the backend. Verify the Home screen looks normal (no banner).
2.  **Plain Text Check:** Set `APP_ANNOUNCEMENT="Welcome to HollowScan! Huge deals dropping today."`. Verify the banner appears and scrolls smoothly.
3.  **Link Check:** Set `APP_ANNOUNCEMENT="Check out our [TCG store](https://www.pokemoncenter.com) for new drops!"`. 
    - Verify "TCG store" is colored differently/underlined.
    - Verify clicking it opens the browser to that URL.
4.  **Responsiveness:** Verify the banner looks good on both iOS and Android.

---
*I will ensure the design is subtle, professional, and fits the HollowScan "Dark/Premium" aesthetic perfectly.*
