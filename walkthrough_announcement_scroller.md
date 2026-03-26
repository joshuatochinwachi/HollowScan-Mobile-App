# Walkthrough: Remote Announcement Scroller

The Remote Announcement Scroller is now fully integrated. This feature allows you to display professional, scrolling messages at the top of the Home page by simply updating an environment variable on your Railway backend.

## 🚀 Key Features

*   **Dynamic Visibility:** The banner is only visible when `APP_ANNOUNCEMENT` has content. If the variable is empty, the app layout is clean and normal.
*   **Professional Ticker:** A smooth, horizontal marquee animation (ticker style) that handles any message length.
*   **Markdown Link Support:** Supports the `[Label](URL)` format for embedding clickable links.
*   **Dark/Light Mode Ready:** Automatically adjusts its aesthetic to match your premium theme.

---

## 🛠️ How to Use (Railway Setup)

To display a message, add or update the `APP_ANNOUNCEMENT` environment variable in your Railway Dashboard.

### 1. Plain Text Message
`APP_ANNOUNCEMENT="Welcome to HollowScan! Huge deals dropping today."`

### 2. Message with a Link
`APP_ANNOUNCEMENT="Don't miss out!!! Check out our [TCG store](https://www.pokemoncenter.com) for some dope new products."`

### 3. Multiple Links
`APP_ANNOUNCEMENT="Follow us on [Twitter](https://twitter.com) and join our [Discord](https://discord.gg)!"`

> [!TIP]
> **Always use quotes** around the value in Railway if your message contains spaces or special characters.

---

## 🏗️ Implementation Details

### Backend
*   **Endpoint:** `/v1/announcement` (GET)
*   **Logic:** Simply reads `os.getenv("APP_ANNOUNCEMENT")`.

### Frontend
*   **Component:** [components/AnnouncementBanner.js](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/components/AnnouncementBanner.js)
*   **Animation:** Uses `Animated.loop` and `Easing.linear` for a consistent, professional speed.
*   **Parsing:** A custom regex parser identifies links and renders them as interactive `Text` elements using `Linking` API.

---

## ✅ Final Verification

1.  **Backend Check:** Verified that `/v1/announcement` returns the correct message from the environment.
2.  **Home Screen Check:** Verified that [HomeScreen.js](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/screens/HomeScreen.js) fetches the message and renders the [AnnouncementBanner](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Mobile-App/components/AnnouncementBanner.js#15-97).
3.  **Link Check:** Verified that the regex accurately identifies links and opens them in the system browser.

**No existing app functionality was modified; this was a purely additive and safe change.**
