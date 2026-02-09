# Backend Database Schema Integration

## Overview

The backend (`main_api.py`) has been updated to use the proper Supabase database schema instead of relying on JSON files and simple user IDs. All endpoints now use the correct tables and UUID-based user management.

---

## New Database Helper Functions

### User Management Functions

**`get_user_by_id(user_id: str) -> Optional[Dict]`**
- Queries `users` table by UUID
- Returns full user object with subscription, preferences, etc.
- Used by: all endpoints requiring user lookup

**`get_user_by_email(email: str) -> Optional[Dict]`**
- Queries `users` table by email
- Returns user object
- Used for: email-based authentication

**`create_user(email: str = None, apple_id: str = None) -> Optional[Dict]`**
- Inserts new user into `users` table
- Generates UUID automatically
- Sets default values: subscription_status = 'free'
- Returns: new user object

**`update_user(user_id: str, updates: Dict) -> bool`**
- Updates user fields in `users` table
- Automatically sets `updated_at` timestamp
- Used by: subscription updates, preference changes, quota management

### Telegram Integration Functions

**`link_telegram_account(user_id: str, telegram_id: str, telegram_username: str = None) -> Optional[Dict]`**
- Inserts into `user_telegram_links` table
- Supports 1:N linking (one user can have multiple Telegram accounts)
- Sets `linked_at` timestamp
- Returns: link object with UUID

**`get_telegram_links_for_user(user_id: str) -> List[Dict]`**
- Queries `user_telegram_links` for a user
- Returns all linked Telegram accounts
- Used for: managing multiple links per user

### Saved Deals Functions

**`save_deal(user_id: str, alert_id: str, alert_data: Dict) -> Optional[Dict]`**
- Inserts into `saved_deals` table
- Stores full alert data for offline access
- Returns: saved deal object with UUID

**`get_saved_deals(user_id: str) -> List[Dict]`**
- Queries `saved_deals` for a user
- Returns all bookmarked deals
- Used by: ProfileScreen saved deals display

---

## Updated Endpoints

### GET `/v1/categories`

**Changes**:
- Now queries `categories` table first (with filters: `active=true`)
- Falls back to `channels.json` if database unavailable
- Organized by `country_code` from database
- Uses `display_name` field for user-friendly names

**Response**:
```json
{
  "US": ["US Flips", "US FBA Deals", ...],
  "UK": ["UK Flips", "UK FBA Deals", ...],
  "CA": ["CA Flips", ...]
}
```

**Database Query**:
```
SELECT * FROM categories 
WHERE active = true 
ORDER BY display_name ASC
```

### GET `/v1/user/status`

**Changes**:
- Uses `get_user_by_id()` helper
- Checks `subscription_status` field (can be 'free', 'active', 'expired')
- Reads `daily_free_alerts_viewed` and `alert_retention_days` from user
- Calculates is_premium from subscription_status

**Response**:
```json
{
  "status": "active",
  "views_used": 2,
  "views_limit": 4,
  "is_premium": true
}
```

### POST `/v1/user/telegram/link`

**Changes**:
- Uses `link_telegram_account()` to store in `user_telegram_links` table
- Checks premium status from `data/bot_users.json` (Telegram bot data)
- Updates `users` table with:
  - `subscription_status`: 'active' (if premium found)
  - `subscription_end`: expiry date from Telegram
  - `subscription_source`: 'telegram'
- Now supports multiple Telegram accounts per user

**Request**:
```
POST /v1/user/telegram/link?user_id=550e8400-e29b-41d4-a716-446655440000&telegram_chat_id=123456789&telegram_username=john_doe
```

**Response** (if premium):
```json
{
  "success": true,
  "message": "Telegram account linked and premium status synced!",
  "is_premium": true,
  "premium_until": "2026-12-31T23:59:59Z",
  "telegram_chat_id": 123456789,
  "telegram_username": "john_doe"
}
```

---

## Database Tables Used

### `users` (Core User Table)
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| email | VARCHAR | Email authentication |
| email_verified | BOOLEAN | Email confirmation status |
| apple_id | VARCHAR | Apple login |
| subscription_status | VARCHAR | 'free', 'active', 'expired', 'cancelled' |
| subscription_source | VARCHAR | 'apple', 'stripe', 'telegram' |
| subscription_end | TIMESTAMPTZ | Premium expiry date |
| notification_preferences | JSONB | {"US": ["flips"], "UK": ["fba"]} |
| daily_free_alerts_viewed | INTEGER | Quota tracking |
| last_free_alert_reset | TIMESTAMPTZ | Reset timestamp |
| created_at | TIMESTAMPTZ | Account creation |
| updated_at | TIMESTAMPTZ | Last update |

### `user_telegram_links` (Telegram Linking)
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| user_id | UUID FK | Reference to users |
| telegram_id | VARCHAR | Telegram chat ID (unique per account) |
| telegram_username | VARCHAR | Telegram username (optional) |
| linked_at | TIMESTAMPTZ | Link timestamp |
| last_used | TIMESTAMPTZ | Last activity |

### `categories` (Dynamic Categories)
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| country_code | VARCHAR | 'US', 'UK', 'CA', 'EU', etc. |
| category_name | VARCHAR | 'flips', 'fba', 'retail_arbitrage' |
| display_name | VARCHAR | User-friendly display |
| active | BOOLEAN | Include in listings |
| created_at | TIMESTAMPTZ | Creation time |

### `alerts` (Product Alerts)
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| country_code | VARCHAR | Market region |
| category_name | VARCHAR | Deal type |
| product_data | JSONB | Full product info |
| created_at | TIMESTAMPTZ | Post timestamp |

### `saved_deals` (Bookmarked Deals)
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| user_id | UUID FK | Reference to users |
| alert_id | VARCHAR | Product ID being saved |
| alert_data | JSONB | Full product data for offline |
| saved_at | TIMESTAMPTZ | Bookmark time |

---

## Key Features Implemented

✅ **UUID-Based Users** - All user IDs are now UUIDs (universally unique)  
✅ **Multiple Telegram Links** - Users can link multiple Telegram accounts  
✅ **Database-First Categories** - Categories stored in database with auto-discovery  
✅ **Proper Subscriptions** - subscription_status, subscription_source, subscription_end fields  
✅ **User Preferences** - JSONB notification_preferences for category subscriptions  
✅ **Saved Deals Tracking** - Bookmarked items stored with full data for offline  
✅ **Automatic Timestamps** - created_at, updated_at, last_used auto-managed  
✅ **Indexes** - Database indexes for fast queries on common fields  

---

## Migration Path

### From Old System to New

**Old User ID Format**:
```javascript
// Simple string ID
user_id: "user-1"
```

**New User ID Format**:
```javascript
// UUID format
user_id: "550e8400-e29b-41d4-a716-446655440000"
```

**Creating New Users**:
```python
# Backend generates UUID automatically
user = create_user(email="user@example.com", apple_id="apple-id-xxx")
# Returns: {"id": "550e8400...", "email": "user@example.com", ...}
```

**Frontend Update Required**:
```javascript
// Old way
const userId = 'user-1';

// New way (from auth context)
import { useAuth } from '../context/AuthContext';
const { user } = useAuth();
const userId = user.id; // UUID from auth
```

---

## Backward Compatibility

The following functions are kept for backward compatibility:

**`get_user_from_db(user_id: str)`**
- Now just calls `get_user_by_id(user_id)`
- Existing code using this function will still work

---

## Error Handling

All database functions include try-catch with logging:

```python
try:
    # Database operation
except Exception as e:
    print(f"[DB] Error: {e}")
    return None
```

Endpoints properly return HTTP errors:

```python
if not user:
    raise HTTPException(status_code=404, detail="User not found")
```

---

## Performance Optimizations

Database indexes created for:
- `users.email` - Email lookups
- `users.subscription_status, subscription_end` - Premium user queries
- `user_telegram_links.user_id` - Find links for a user
- `user_telegram_links.telegram_id` - Find user by Telegram ID
- `saved_deals.user_id` - Get user's saved deals
- `categories.country_code` - Filter by country

---

## Testing Checklist

- [ ] User lookup by UUID works
- [ ] Create new user generates valid UUID
- [ ] Telegram link stored in correct table
- [ ] Telegram link retrieval returns all links
- [ ] Categories loaded from database
- [ ] Categories fallback to channels.json works
- [ ] Saved deals stored and retrieved correctly
- [ ] Subscription status syncs from Telegram
- [ ] User quota updates work
- [ ] Indexes are created and improve performance

---

## Next Steps

1. ✅ Update backend to use schema
2. 📋 Update frontend to use UUID user IDs
3. 📋 Create auth context for user management
4. 📋 Migrate existing user data to new schema
5. 📋 Update ProfileScreen saved deals to use database
6. 📋 Implement notification preferences storage/retrieval
7. 📋 Add endpoint to manage user preferences

---

## Reference

All database operations go through helper functions, not direct REST calls. This allows for:
- Consistent error handling
- Logging and debugging
- Easy schema changes
- Type safety

Example adding a new field:
```python
# Update one function
def update_user(user_id: str, updates: Dict):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    # ... rest of function
```

All callers automatically benefit from the change.

---

## Support

For database issues:
1. Check Supabase dashboard for table schema
2. Verify indexes exist
3. Check logs for `[DB]` tagged messages
4. Review error response from endpoint

---

Generated: Backend Schema Integration Complete
Version: 1.0
Date: 2026-01-31
