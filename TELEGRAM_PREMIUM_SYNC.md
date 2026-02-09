# Telegram Premium Sync Feature

## Overview

When a user links their Telegram account in the HollowScan mobile app, the system now:
1. Checks if they have an active premium subscription on the `@HollowscanBot`
2. Automatically syncs their premium status to the mobile app
3. Unlocks all premium features if they're premium on Telegram

---

## How It Works

### User Flow

```
1. User opens ProfileScreen → Integrations section
2. User taps "Telegram Bot" to link account
3. Modal shows two input fields:
   - Chat ID (numeric ID from bot /start message)
   - Telegram username (@username)
4. User opens Telegram bot via "🤖 Open HollowScan Bot" button
5. User starts bot with /start → Gets their chat ID
6. User pastes chat ID and enters username in app
7. Clicks "Link Account"
8. Backend checks:
   - Loads telegram_bot.py users from data/bot_users.json
   - Looks up user by telegram_chat_id
   - Checks if their "expiry" date is in the future
9. If premium found:
   - ✅ Updates app user to premium status
   - Shows success message with premium expiry date
   - Displays premium badge in Integrations section
10. If not premium:
   - ✅ Links account for notifications
   - Shows message suggesting upgrade on Telegram bot
```

---

## Technical Implementation

### Backend Endpoint: `POST /v1/user/telegram/link`

**Location**: `main_api.py` (lines ~503-580)

**Parameters**:
- `user_id` (query): App user ID
- `telegram_chat_id` (query): Telegram chat ID (integer)

**Request**:
```javascript
POST /v1/user/telegram/link?user_id=user-123&telegram_chat_id=987654321
```

**Response (If Premium Found)**:
```json
{
  "success": true,
  "message": "Telegram account linked and premium status synced!",
  "is_premium": true,
  "premium_until": "2026-12-31T00:00:00Z",
  "telegram_chat_id": 987654321
}
```

**Response (If Not Premium)**:
```json
{
  "success": true,
  "message": "Telegram account linked successfully",
  "is_premium": false,
  "premium_until": null,
  "telegram_chat_id": 987654321,
  "note": "No active premium found on Telegram bot"
}
```

### Backend Logic

```python
# 1. Load telegram bot users
with open("data/bot_users.json") as f:
    telegram_users = json.load(f)
    telegram_user_data = telegram_users.get(str(chat_id))

# 2. Check premium status
if telegram_user_data and 'expiry' in telegram_user_data:
    expiry_date = datetime.fromisoformat(telegram_user_data['expiry'])
    is_premium = expiry_date > datetime.now(timezone.utc)

# 3. If premium, update user in database
if is_premium:
    update_db_user({
        "subscription_status": "active",
        "premium_from_telegram": True,
        "telegram_chat_id": chat_id,
        "telegram_premium_until": expiry_date,
        "linked_at": now()
    })
```

### Frontend State & Logic

**New State Variables** (ProfileScreen.js):
```javascript
const [telegramChatId, setTelegramChatId] = useState(null);
const [isPremium, setIsPremium] = useState(false);
const [premiumUntil, setPremiumUntil] = useState(null);
const [userId, setUserId] = useState('user-1'); // From auth context
```

**Updated Handler** (`handleTelegramLink`):
```javascript
const handleTelegramLink = async () => {
    // Call endpoint
    const response = await fetch(
        `${API_BASE_URL}/v1/user/telegram/link?user_id=${userId}&telegram_chat_id=${telegramChatId}`,
        { method: 'POST' }
    );
    
    const data = await response.json();
    
    if (data.is_premium) {
        setIsPremium(true);
        setPremiumUntil(data.premium_until);
        Alert.alert('🎉 Welcome to Premium!', 
            `Premium until: ${new Date(data.premium_until).toLocaleDateString()}`);
    }
    
    setTelegramLinked(true);
}
```

### UI Updates

**Modal Input Fields**:
- Chat ID (number input) - Required
- Username (text input) - For record-keeping
- Both required before linking

**Success State - If Premium**:
```
✅ Telegram connected!

👑 Premium Status Synced!
Premium until: 12/31/2026
All premium features are now available on this app.

You will receive:
✓ Instant deal notifications
✓ Custom price alerts
✓ ROI-based deals

[Unlink] [Done]
```

**Integrations Section Display**:
- If premium: `👑 Premium until 12/31/2026`
- If linked (not premium): `Receiving notifications`
- If not linked: `Connect for alerts`

---

## Data Source

The backend checks for premium status by:
1. Reading `data/bot_users.json` (created by telegram_bot.py)
2. Looking for key = `str(telegram_chat_id)`
3. Checking if `user_data['expiry']` is a future ISO8601 timestamp

### User Data Structure in bot_users.json
```json
{
  "987654321": {
    "user_id": "john",
    "first_name": "John",
    "username": "johndoe",
    "expiry": "2026-12-31T23:59:59Z",
    "stripe_subscription_id": "sub_xxx",
    "subscribed_categories": [...],
    ...
  }
}
```

---

## User Interface Flow

### Before Linking
```
INTEGRATIONS
┌──────────────────────────────────┐
│ 📱 Telegram Bot     [Not linked] │
│ Connect for alerts              │
└──────────────────────────────────┘
```

### After Linking (Not Premium)
```
INTEGRATIONS
┌──────────────────────────────────┐
│ 📱 Telegram Bot     [✓ Linked]   │
│ Receiving notifications          │
└──────────────────────────────────┘
```

### After Linking (Premium)
```
INTEGRATIONS
┌──────────────────────────────────┐
│ 📱 Telegram Bot     [✓ Linked]   │
│ 👑 Premium until 12/31/2026     │
└──────────────────────────────────┘
```

---

## Key Features

✅ **Automatic Premium Detection** - Checks Telegram bot data automatically  
✅ **Seamless Sync** - User premium status syncs instantly  
✅ **Clear Feedback** - Shows premium expiry date prominently  
✅ **No Double Billing** - Telegram premium maps to app premium (no extra charge)  
✅ **Error Handling** - Graceful handling if user not found on Telegram  
✅ **Visual Indicators** - Premium badge and special messaging  

---

## Testing Checklist

- [ ] User can open Telegram bot from app
- [ ] Chat ID input accepts numbers only
- [ ] Username input accepts @ symbol
- [ ] Validation rejects empty fields
- [ ] Backend returns premium status correctly
- [ ] UI shows premium badge when premium
- [ ] Premium expiry date displays correctly
- [ ] Non-premium users see upgrade suggestion
- [ ] Unlink still works correctly
- [ ] Premium benefits are unlocked in app

---

## Dependencies

- `telegram_bot.py` running and updating `data/bot_users.json`
- User Stripe subscription status synced in bot_users.json
- Supabase users table with subscription fields
- Main API with `/v1/user/telegram/link` endpoint

---

## Future Enhancements

1. **Real-time Sync** - Webhook from Telegram bot when user upgrades
2. **Auto-Renewal** - Automatically check and update premium status weekly
3. **Premium Perks** - Show specific features unlocked when premium
4. **Upgrade Flow** - Direct link to Stripe checkout if not premium
5. **Multi-Device Sync** - Sync across all user's devices

---

## Troubleshooting

**Problem**: "User not found" error
- **Solution**: Ensure user exists in app database before linking

**Problem**: Premium status not syncing
- **Solution**: Verify `data/bot_users.json` contains user with correct chat_id and expiry date

**Problem**: Telegram bot not opening
- **Solution**: User needs Telegram app installed; check if `t.me/HollowscanBot` is correct bot username

**Problem**: Can't find Chat ID
- **Solution**: User must start bot with `/start` command first - bot will send their chat ID

---

Generated: Telegram Premium Sync Implementation
Version: 1.0
Date: 2026-01-31
