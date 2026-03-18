# Walkthrough: Telegram Sync Fix

This walkthrough documents the resolution of the Telegram sync issue, where in-app purchases failed to activate premium status on the linked Telegram account.

## Changes Made

### Backend (FastAPI)

#### [app.py](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py)

- **Fixed Supabase Storage Upload URL**: Corrected the URL in [update_bot_user_premium](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py#2504-2540) which was incorrectly using `/rest/v1/object/authenticated/` for a `POST` (upload) operation.
- **Removed `authenticated/` segment**: Supabase Storage `POST` requests for uploads expect the bucket name immediately after `/object/`.
- **Fixed Typo**: Ensured the endpoint uses `/storage/` instead of `/rest/`.

```python
# Before
storage_url = f"{URL}/rest/v1/object/authenticated/{SUPABASE_BUCKET}/discord_josh/bot_users.json"

# After
storage_url = f"{URL}/storage/v1/object/{SUPABASE_BUCKET}/discord_josh/bot_users.json"
```

## Verification Results

### Code Audit
- Verified that the `GET` (download) URL in [get_bot_users_data](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py#760-784) remains unchanged as it was already using the correct `/storage/v1/object/authenticated/...` format required for authenticated downloads.
- Verified that [update_bot_user_premium](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py#2504-2540) is correctly called from both the Google Play and Apple IAP verification endpoints, as well as the account unlinking endpoint.

## How to Verify in Production

1. **Deploy the Backend**: Since the fix is in [app.py](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py), you need to push these changes to your production environment (e.g., Railway).
2. **Link/Re-link Telegram**: In the HollowScan mobile app, go to Settings -> Telegram and link your account (or unlink and re-link if already linked).
3. **Check Logs**: Monitor your backend logs for the message:
   `[SYNC] Successfully updated bot_users.json for telegram_id <your_id>`
4. **Verify on Telegram Bot**: Send a message to the HollowScan Telegram bot. It should now recognize you as a Premium user if you have an active subscription in the app.
