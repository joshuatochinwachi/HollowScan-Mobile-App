# Telegram Sync Fix Implementation Plan

The objective is to resolve the "Bucket not found" error that occurs when syncing premium status to the Telegram bot. This failure prevents in-app purchases from activating premium features on the linked Telegram account.

## User Review Required

> [!NOTE]
> The fix involves a simple URL correction in the backend. I have also verified that the upload logic (using `POST` with `x-upsert: true`) is consistent with Supabase Storage best practices.

## Proposed Changes

### HollowScan-Fast-API-Backend

#### [MODIFY] [app.py](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py)

- Fix the Supabase Storage URL in [update_bot_user_premium](file:///c:/Users/Jo$h/Desktop/Visual%20Studio%20Code/HollowScan-Fast-API-Backend/app.py#2504-2540) by changing `/rest/v1/object/` to `/storage/v1/object/`.
- Ensure the bucket name and path are correctly constructed.

## Verification Plan

### Automated Tests
- I will run a script to verify the Supabase Storage endpoint connectivity and specifically check if a test file can be uploaded using the corrected URL format.

### Manual Verification
- The user can trigger a sync by unlinking and re-linking their Telegram account (which should now correctly update the `bot_users.json` file).
- The user can check the backend logs for the `[SYNC] Successfully updated bot_users.json` message.
- Verify that the Telegram bot now recognizes the user's premium status after a purchase or link after unlinking and relinking.
