# Fix Telegram Bot Status Match

The app is successfully updating the `bot_users.json` file in Supabase Storage, and the mobile app correctly reads it back as "active". However, the Telegram bot still shows "not subscribed". This is likely due to a date format mismatch: Python's `isoformat()` uses `+00:00` for UTC, while the bot seems to strictly expect the `Z` suffix.

## Proposed Changes

### Backend (app.py)
#### [MODIFY] [app.py](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py)
- Update [update_bot_user_premium](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py#2504-2540) to use the `Z` suffix for all ISO dates sent to the bot.
- Change the `source` back to [google_play](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py#2550-2599) or a bot-friendly string if `mobile_app` is suspected of being ignored (I'll start with just the date fix first).

## Verification Plan

### Manual Verification
1. Deploy the changes to Railway.
2. In the mobile app, unlink and re-link the Telegram account (this triggers a fresh sync).
3. Verify that the app still shows "Sync active".
4. Check the Telegram bot status. If it still fails, I will request the user to check if the bot needs a restart or if they can provide the bot's logs.
