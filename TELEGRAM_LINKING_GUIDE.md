# Telegram Account Linking - Simplified Key-Based System

## Overview

Users no longer need to manually find their Telegram chat ID. Instead, the app generates a unique link key that users send to the bot, which automatically completes the linking process.

---

## How It Works

### User Flow

```
User taps "Connect Telegram" in Profile
         ↓
App generates unique 6-character link key
(e.g., "ABC123XYZ")
         ↓
User sees instruction:
"Send /link ABC123XYZ to @Hollowscan_bot"
         ↓
User taps "Open @Hollowscan_bot" or manually opens Telegram
         ↓
User sends: /link ABC123XYZ to bot
         ↓
Bot receives command
         ├─ Validates key exists and is pending
         ├─ Checks key hasn't expired (15-minute window)
         ├─ Marks key as used
         ├─ Extracts user's Telegram chat_id from message context
         └─ Calls backend to link account
         ↓
Backend updates database:
├─ Adds entry to user_telegram_links table
├─ Extracts user's Telegram premium status from bot_users.json
└─ If premium, syncs to app subscription
         ↓
Bot sends confirmation message to user:
"✅ Account Linked!" or "🎉 Premium Synced!"
         ↓
App polling detects link was successful
         ↓
User sees "✅ Telegram Connected!" in Profile
```

---

## Technical Implementation

### 1. Backend Endpoints (main_api.py)

#### `POST /v1/user/telegram/generate-key`
**Purpose**: Generate a new link key for a user

**Parameters**:
- `user_id` (UUID) - The app user ID

**Response**:
```json
{
  "success": true,
  "link_key": "ABC123",
  "message": "Send this message to @Hollowscan_bot: /link ABC123",
  "expires_in_minutes": 15
}
```

**Storage**: Keys stored in `data/pending_telegram_links.json`
```json
{
  "ABC123": {
    "user_id": "8923304e-657e-4e7e-800a-94e7248ecf7f",
    "created_at": "2026-01-31T12:00:00+00:00",
    "expires_at": "2026-01-31T12:15:00+00:00",
    "used": false,
    "used_at": null,
    "telegram_id": null,
    "telegram_username": null
  }
}
```

#### `GET /v1/user/telegram/link-status`
**Purpose**: Check if a user's link has been completed by the bot

**Parameters**:
- `user_id` (UUID) - The app user ID

**Response** (Not yet linked):
```json
{
  "success": true,
  "linked": false,
  "message": "Waiting for you to send the link command to the Telegram bot"
}
```

**Response** (Successfully linked):
```json
{
  "success": true,
  "linked": true,
  "telegram_id": "123456789",
  "telegram_username": "john_doe",
  "is_premium": false
}
```

#### `POST /v1/user/telegram/link`
**Purpose**: Complete the linking by saving Telegram chat ID and syncing premium status

**Parameters**:
- `user_id` (UUID) - The app user ID
- `telegram_chat_id` (int) - User's Telegram chat ID
- `telegram_username` (string) - Optional Telegram username

**Response**:
```json
{
  "success": true,
  "message": "Telegram account linked",
  "is_premium": true,
  "premium_until": "2026-12-31T23:59:59+00:00"
}
```

### 2. Telegram Bot Handler (telegram_bot.py)

#### `/link` Command Handler
**Location**: `async def link_app_account()`

**Process**:
1. Extract link key from `/link ABC123` command
2. Load `data/pending_telegram_links.json`
3. Verify:
   - Key exists
   - Key not already used
   - Key not expired (15 minutes max)
4. Mark key as used and store:
   - Telegram chat ID (from `update.effective_user.id`)
   - Telegram username (from `update.effective_user.username`)
5. Call backend `/v1/user/telegram/link` endpoint
6. Send response message to user

**Example Messages**:
- ✅ Success: "✅ Account Linked! Your app account has been linked to Telegram!"
- 🎉 Premium: "🎉 Linked & Premium Synced! Premium until: [DATE]"
- ❌ Invalid: "❌ Invalid link key. Please get a new key from the app."

### 3. Frontend Components (ProfileScreen.js)

#### State Variables
```javascript
const [telegramLinked, setTelegramLinked] = useState(false);
const [telegramModalVisible, setTelegramModalVisible] = useState(false);
const [telegramLinkKey, setTelegramLinkKey] = useState(null);
const [isGeneratingKey, setIsGeneratingKey] = useState(false);
const [isCheckingStatus, setIsCheckingStatus] = useState(false);
```

#### `handleGenerateLinkKey()`
- Calls `POST /v1/user/telegram/generate-key`
- Displays key in modal
- Shows copy button
- Shows instruction: "Send /link [KEY] to @Hollowscan_bot"

#### `handleCheckLinkStatus()`
- Calls `GET /v1/user/telegram/link-status`
- If linked: Sets `telegramLinked = true` and shows success message
- If not yet linked: Shows "Waiting..." message
- If premium synced: Shows "🎉 Premium!" message

#### Modal UI States

**State 1: Generate Key**
- Title: "Connect Telegram Bot"
- Shows button: "🔑 Generate Link Key"
- Shows instructions in info box

**State 2: Waiting for Bot**
- Title: "Connect Telegram Bot"
- Displays link key in large format with copy button
- Shows command to send: `/link ABC123`
- "Open @Hollowscan_bot" button
- "Check Status" button

**State 3: Linked Successfully**
- Title: "Telegram Connected"
- Shows checkmark emoji
- Lists benefits:
  - ✓ Instant deal notifications
  - ✓ Custom price alerts
  - ✓ ROI-based deals
- Shows "Unlink" and "Done" buttons
- If premium: Shows "👑 Premium Status Synced!" box

---

## Key Advantages

✅ **No Manual Chat ID Entry**: Users don't need to find their chat ID  
✅ **Automatic Premium Sync**: Premium status from Telegram auto-syncs to app  
✅ **Self-Service Link Verification**: Bot handles chat ID extraction  
✅ **15-Minute Expiry**: Links expire after 15 minutes for security  
✅ **One-Time Use**: Link keys can only be used once  
✅ **Clean UX**: No technical details exposed to users  

---

## Flow Diagram

```
┌─ App ─────────────────────────────────┐
│                                       │
│  User taps "Connect Telegram"         │
│         ↓                             │
│  [Generate Key] ←─────────┐           │
│         ↓                 │           │
│  Show: /link ABC123       │           │
│  [Copy] [Open Bot]        │           │
│         ↓                 │           │
│  [Check Status] ←─────┐   │           │
│         ↓            │   │           │
│  ✅ Linked!          │   │           │
│                      │   │           │
└──────────────────────┼───┼───────────┘
                       │   │
                       │   │ POST /generate-key
                       │   │
                       └───┴─→ Backend (main_api.py)
                           │
                           ↓ Generate key ABC123
                           ↓ Store in pending_links.json
                           ↓ Return key + instructions
                           │
                    ┌──────┴──────┐
                    ↓             ↓
              (15 min timer)   User sends
                               /link ABC123
                                   │
                    ┌──────────────┘
                    │
                    ↓
          ┌─ Telegram Bot ──────────┐
          │                         │
          │  Receive /link ABC123   │
          │         ↓               │
          │  Validate key           │
          │  Check expiry           │
          │  Get chat_id from msg   │
          │  Get username from msg  │
          │         ↓               │
          │  Call backend /link     │
          │         ↓               │
          │  Send confirmation      │
          │                         │
          └────────┬────────────────┘
                   │
                   │ POST /link
                   ↓
          Backend stores in DB:
          - user_telegram_links
          - Check bot_users.json for premium
          - Sync premium to users table
                   │
                   └─→ App polls /link-status
                       ↓
                       ✅ Linked & possibly synced to Premium!
```

---

## Data Flow

### File Structure
```
data/
├── pending_telegram_links.json    ← Stores link keys (expires after 15 min)
├── bot_users.json                  ← Telegram user data with premium info
└── ... (other files)
```

### Database Schema
```sql
-- user_telegram_links table
CREATE TABLE user_telegram_links (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  telegram_id text NOT NULL,
  telegram_username text,
  is_premium boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
);

-- users table (updated)
subscription_status   -- "active" if premium on Telegram
subscription_source   -- "telegram"
subscription_end      -- Premium expiry date from Telegram bot
```

---

## Error Handling

**Invalid Key**: "❌ Invalid or expired link key."
**Key Expired**: "⏰ Link key has expired. Get a new one from the app."
**Already Used**: "⚠️ This key has already been used."
**Backend Error**: "⚠️ Linking failed. Please try again."
**Network Error**: "⚠️ Could not reach backend. Please try again."
**System Error**: "⚠️ System error. Please try again."

---

## Security Considerations

1. **One-Time Keys**: Each link key can only be used once
2. **Time-Limited**: Keys expire after 15 minutes
3. **User Verification**: Bot verifies key exists before linking
4. **Chat ID Extraction**: Bot gets chat ID from message context, not user input
5. **No Manual IDs**: Users never handle technical chat IDs
6. **Premium Verification**: Premium status verified against telegram bot data

---

## Testing Checklist

- [ ] Tap "Connect Telegram" in Profile
- [ ] Verify link key is generated (6 characters, uppercase)
- [ ] Copy link key to clipboard
- [ ] Open Telegram bot
- [ ] Send `/link ABC123` to bot
- [ ] Verify bot sends success message
- [ ] Return to app and tap "Check Status"
- [ ] Verify "✅ Telegram Connected!" appears
- [ ] Check premium syncs if user is premium on Telegram
- [ ] Test expiry: Wait 15 minutes and try old key
- [ ] Test one-time use: Try same key twice
- [ ] Unlink and re-link with new key
- [ ] Verify user can toggle notifications after linking

---

## Deployment Notes

1. Ensure `data/pending_telegram_links.json` is writable
2. Backend must be running before app attempts linking
3. Telegram bot must have `/link` command handler registered
4. Verify `bot_users.json` is accessible for premium checks
5. Database `user_telegram_links` table must exist
6. Test linking flow end-to-end in sandbox first

---

## Future Enhancements

- Push notifications for link confirmations
- Email notifications when Telegram premium expires
- Link expiry reminder notifications
- Analytics on linking success rate
- QR code generation instead of text key (more mobile-friendly)
- WebSocket updates instead of polling for instant status
- Multiple Telegram account linking per app user

---

Generated: Telegram Linking System Documentation  
Version: 2.0  
Date: January 31, 2026  
Status: ✅ Implementation Complete
