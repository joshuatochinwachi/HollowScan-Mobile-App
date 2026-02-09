# Telegram Integration Architecture

## Overview
The ProfileScreen now includes a fully functional Telegram bot linking interface. This document explains how to complete the backend integration.

---

## Current Status

### ✅ Frontend Complete
- [x] Telegram linking modal (connection + success states)
- [x] Username input with validation
- [x] Direct Telegram bot link button (`t.me/HollowscanBot`)
- [x] Loading states and error handling
- [x] Unlink functionality with confirmation
- [x] Visual status indicator in Integrations section

### ⏳ Backend Needed
- [ ] Telegram linking endpoint
- [ ] Telegram chat verification
- [ ] User-Telegram mapping storage
- [ ] Message delivery system

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────┐
│                   USER (Mobile App)                     │
│  Opens Profile → Taps "Telegram Bot" → Modal appears   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ├─ Option 1: Tap bot link
                         │  Opens: t.me/HollowscanBot
                         │
                         └─ Option 2: Enter username manually
                            Click "Link Account"
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │ POST /v1/user/telegram/link           │
        │ {                                     │
        │   "telegram_username": "@user",       │
        │   "user_id": "current_user"           │
        │ }                                     │
        └────────────┬────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────────────────┐
        │   Backend Verification:                  │
        │   1. Query Telegram Bot API              │
        │   2. Get user's chat ID                  │
        │   3. Store in database                   │
        │   4. Return confirmation                 │
        └────────────┬─────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────────────────┐
        │   Frontend Updates:                      │
        │   - Show success state                   │
        │   - Set telegramLinked = true            │
        │   - Display "✓ Linked" status            │
        │   - Show benefits list                   │
        └──────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Telegram Bot (if not already done)

1. **Talk to BotFather on Telegram**
   - Message: @BotFather
   - Command: `/newbot`
   - Follow prompts to create bot
   - Copy API token (e.g., `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

2. **Set Bot Commands**
   ```
   /setcommands
   
   Commands:
   start - Start receiving deal notifications
   stop - Stop notifications
   status - Check connection status
   ```

3. **Enable Privacy Mode** (optional but recommended)
   - `/setprivacy` → select "Disable"
   - This lets bot see all messages in groups

### Step 2: Install python-telegram-bot

```bash
pip install python-telegram-bot
```

### Step 3: Create Backend Endpoint

**File**: `main_api.py`

```python
from telegram import Bot
from telegram.error import TelegramError
import os

# At top of file
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', 'your-bot-token-here')
telegram_bot = Bot(token=TELEGRAM_BOT_TOKEN)

# Endpoint to link Telegram account
@app.post("/v1/user/telegram/link")
async def link_telegram_account(
    request: Request,
    user_id: str = Query(...),
    telegram_username: str = Query(...)
):
    """
    Links a user's Telegram account to their profile.
    Telegram user must have started the bot first.
    """
    try:
        # Verify the user has started the bot
        # This is a basic check - in production, verify more thoroughly
        
        # Store telegram mapping in database
        # Example using supabase:
        supabase.table('user_telegram_mappings').insert({
            'user_id': user_id,
            'telegram_username': telegram_username,
            'linked_at': datetime.now().isoformat(),
            'active': True
        }).execute()
        
        # Send verification message to user via Telegram
        message_text = (
            "✅ Your HollowScan account has been successfully linked!\n\n"
            "You will now receive notifications for deals matching your criteria.\n\n"
            "Use /stop to disable notifications anytime."
        )
        
        # Note: This requires getting the user's chat_id
        # See "Advanced: Getting Chat ID" section below
        
        return {
            'success': True,
            'message': 'Telegram account linked successfully',
            'telegram_username': telegram_username
        }
        
    except TelegramError as e:
        return {
            'success': False,
            'message': f'Telegram error: {str(e)}'
        }, 400
    except Exception as e:
        return {
            'success': False,
            'message': f'Error linking account: {str(e)}'
        }, 500
```

### Step 4: Create Telegram Notification Endpoint

**In `main_api.py`:**

```python
@app.post("/v1/user/telegram/send-notification")
async def send_telegram_notification(
    user_id: str = Query(...),
    deal_title: str = Query(...),
    profit: float = Query(...),
    deal_link: str = Query(...)
):
    """
    Sends a deal notification to user's Telegram.
    Called automatically when a matching deal is found.
    """
    try:
        # Get user's telegram_chat_id from database
        mapping = supabase.table('user_telegram_mappings')\
            .select('telegram_chat_id')\
            .eq('user_id', user_id)\
            .eq('active', True)\
            .single()\
            .execute()
        
        if not mapping.data:
            return {'success': False, 'message': 'Telegram not linked'}, 404
        
        chat_id = mapping.data['telegram_chat_id']
        
        # Format message
        message = (
            f"🎉 New Deal Found!\n\n"
            f"<b>{deal_title}</b>\n\n"
            f"💰 Potential Profit: <b>${profit:.2f}</b>\n\n"
            f"<a href='{deal_link}'>View Deal</a>"
        )
        
        # Send message
        await telegram_bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode='HTML'
        )
        
        return {'success': True, 'message': 'Notification sent'}
        
    except TelegramError as e:
        return {'success': False, 'message': f'Telegram error: {str(e)}'}, 500
```

### Step 5: Create Telegram /start Handler

**New file**: `telegram_notification_service.py`

```python
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes
from telegram.constants import ParseMode

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command from Telegram users."""
    user = update.effective_user
    chat_id = update.effective_chat.id
    
    # Store in database
    try:
        supabase.table('telegram_users').insert({
            'chat_id': chat_id,
            'telegram_username': user.username,
            'telegram_user_id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'joined_at': datetime.now().isoformat()
        }).execute()
    except:
        # Already exists, update last seen
        supabase.table('telegram_users')\
            .update({'last_seen': datetime.now().isoformat()})\
            .eq('chat_id', chat_id)\
            .execute()
    
    # Send welcome message
    welcome_text = (
        f"👋 Welcome {user.first_name}!\n\n"
        f"🎯 HollowScan Telegram Bot\n"
        f"Get instant notifications for profitable e-commerce deals!\n\n"
        f"📱 Your Chat ID: <code>{chat_id}</code>\n"
        f"👤 Username: @{user.username}\n\n"
        f"Commands:\n"
        f"/stop - Stop notifications\n"
        f"/status - Check connection\n"
    )
    
    await context.bot.send_message(
        chat_id=chat_id,
        text=welcome_text,
        parse_mode=ParseMode.HTML
    )

async def stop(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /stop command."""
    chat_id = update.effective_chat.id
    
    supabase.table('telegram_users')\
        .update({'notifications_enabled': False})\
        .eq('chat_id', chat_id)\
        .execute()
    
    await context.bot.send_message(
        chat_id=chat_id,
        text="🔇 Notifications disabled. Use /start to re-enable."
    )

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Check connection status."""
    chat_id = update.effective_chat.id
    
    user_data = supabase.table('telegram_users')\
        .select('*')\
        .eq('chat_id', chat_id)\
        .single()\
        .execute()
    
    if user_data.data:
        enabled = user_data.data.get('notifications_enabled', True)
        status_text = "✅ Connected and receiving notifications" if enabled else "🔇 Connected but notifications disabled"
    else:
        status_text = "❌ Not connected"
    
    await context.bot.send_message(chat_id=chat_id, text=status_text)

def start_telegram_bot():
    """Start the Telegram bot service."""
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("stop", stop))
    app.add_handler(CommandHandler("status", status))
    
    app.run_polling()

# In main_api.py startup event:
# asyncio.create_task(start_telegram_bot())
```

---

## Advanced: Getting Chat ID

When user enters Telegram username, you need to get their chat ID:

```python
from telegram import Bot
from telegram.error import TelegramError

async def get_telegram_chat_id(username: str) -> Optional[int]:
    """
    Get Telegram chat ID from username.
    Note: This is tricky because Telegram Bot API doesn't directly support this.
    
    Two approaches:
    1. User clicks link to bot → bot gets chat_id from /start message
    2. Admin manually maps usernames to chat IDs
    """
    
    # Approach: Store chat_id when user /starts the bot
    # Then match with username entered in app
    
    result = supabase.table('telegram_users')\
        .select('chat_id')\
        .eq('telegram_username', username)\
        .single()\
        .execute()
    
    if result.data:
        return result.data['chat_id']
    
    return None
```

---

## Database Schema Required

### `user_telegram_mappings` Table
```sql
CREATE TABLE user_telegram_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    telegram_username TEXT,
    telegram_chat_id BIGINT,
    linked_at TIMESTAMP DEFAULT now(),
    active BOOLEAN DEFAULT true,
    notifications_enabled BOOLEAN DEFAULT true,
    UNIQUE(user_id)
);
```

### `telegram_users` Table
```sql
CREATE TABLE telegram_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id BIGINT UNIQUE NOT NULL,
    telegram_user_id BIGINT,
    telegram_username TEXT,
    first_name TEXT,
    last_name TEXT,
    joined_at TIMESTAMP DEFAULT now(),
    last_seen TIMESTAMP,
    notifications_enabled BOOLEAN DEFAULT true
);
```

---

## Frontend Code (Already Implemented)

The ProfileScreen has:

```javascript
const handleTelegramLink = async () => {
    // Currently simulates linking for 1.5 seconds
    // Replace this with actual API call:
    
    const response = await fetch('http://10.246.149.243:8000/v1/user/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: getCurrentUserId(), // Get from auth context
            telegram_username: telegramUsername
        })
    });
    
    const data = await response.json();
    
    if (data.success) {
        setTelegramLinked(true);
        Alert.alert('Success', 'Telegram account linked!');
    }
};
```

---

## Testing the Integration

### Manual Testing:
1. Run Telegram bot service
2. Start bot: `/start` in Telegram
3. In mobile app, enter your @username
4. Click "Link Account"
5. Check console for chat_id
6. Verify in database that mapping was created

### Automated Test:
```python
# test_telegram_integration.py
import asyncio
from telegram import Bot

async def test_send_message():
    bot = Bot(token='YOUR_BOT_TOKEN')
    
    # Send test message
    await bot.send_message(
        chat_id=YOUR_CHAT_ID,
        text="✅ Telegram integration working!"
    )

asyncio.run(test_send_message())
```

---

## Security Considerations

⚠️ **Important:**
- Never expose bot token in frontend code
- Verify Telegram ownership before linking
- Rate limit linking requests
- Validate user_id matches authenticated user
- Store chat_id securely in database
- Use HTTPS for all API calls
- Implement account unlinking properly

---

## Environment Variables Needed

```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_BOT_USERNAME=HollowscanBot
```

---

## Next Steps

1. ✅ Frontend modal implemented
2. Create tables in Supabase
3. Implement `/v1/user/telegram/link` endpoint
4. Implement `/v1/user/telegram/send-notification` endpoint
5. Deploy Telegram bot service
6. Update frontend to call actual endpoints
7. Test end-to-end

---

## Reference Links
- [python-telegram-bot docs](https://python-telegram-bot.readthedocs.io/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [BotFather guide](https://core.telegram.org/bots#botfather)
