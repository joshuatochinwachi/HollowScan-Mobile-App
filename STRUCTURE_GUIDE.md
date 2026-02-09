# HollowScan App - Structure & Components Guide

## 📁 Project Structure

```
hollowscan_app/
├── App.js                          # Main app entry & navigation setup
├── Constants.js                    # Global constants & branding
├── index.js                        # React Native entry point
├── package.json                    # Dependencies (with expo-linear-gradient)
│
├── screens/                        # All app screens
│   ├── HomeScreen.js              # ✨ ENHANCED: Main feed with deals
│   ├── ProductDetailScreen.js     # ✨ ENHANCED: Deal details & profit calc
│   ├── SavedScreen.js             # Saved/bookmarked deals
│   ├── AlertsScreen.js            # Push notifications
│   └── ProfileScreen.js           # User profile & settings
│
├── context/                        # React Context for state management
│   └── SavedContext.js            # Manages saved deals
│
├── components/                     # Reusable UI components (empty - ready for future)
│
├── data/                          # Local data files
│   ├── channels.json              # List of monitored Discord channels
│   ├── bot_users.json             # Registered bot users
│   └── active_codes.json          # Subscription/promo codes
│
├── assets/                        # Images, fonts, etc (from Expo)
│
└── UI_IMPROVEMENTS.md            # 📋 Detailed design documentation
```

## 🎯 Screen Breakdown

### HomeScreen.js (Main Feed)
**Purpose**: Display live deals from selected region and category

**Key Features**:
- Horizontal region selector (US, UK, CA)
- Category filter with modal (All, Collectors Amazon, etc.)
- Infinite scrolling product feed
- Pull-to-refresh functionality
- Quota tracker (4 free daily alerts)
- Search functionality

**State Management**:
```javascript
- selectedRegion: 'US' | 'UK' | 'CA'
- selectedSub: 'ALL' | category name
- searchQuery: user search input
- alerts: array of products
- dynamicCategories: fetched from API
- quota: { used, limit }
```

**API Endpoints Used**:
- `GET /v1/categories` - Fetch available categories by region
- `GET /v1/feed` - Fetch products with filters
- `GET /v1/user/status` - Check daily quota

---

### ProductDetailScreen.js (Deal Details)
**Purpose**: Show detailed information about a specific product

**Key Features**:
- Large product image with gradient overlay
- Profit calculator (Buy, Sell, Fees, Net Profit, ROI)
- Category and region badges
- Research links (eBay, Amazon, Google)
- Transaction summary (Where to buy/sell)
- Save/Share functionality

**Components**:
- `LinkRow`: Reusable link component with icon and arrow
- Gradient cards for profit analysis
- Action buttons at bottom

---

### SavedScreen.js (Bookmarks)
**Purpose**: View bookmarked/saved deals

**Features**:
- Shows all saved products
- Removes from context on delete
- Access full product details via tap

---

### AlertsScreen.js (Notifications)
**Purpose**: Manage push notifications and alert preferences

**Features**:
- Category selection for alerts
- Toggle notifications on/off
- Notification history

---

### ProfileScreen.js (Account)
**Purpose**: User account and app settings

**Features**:
- User profile info
- Subscription status
- App settings
- Help/Support links

---

## 🔌 API Integration

### Main API Base URL
```javascript
Constants.API_BASE_URL = 'http://10.246.149.243:8000'
```

### Endpoints

#### 1. Get Categories
```
GET /v1/categories
Response: {
  "US": ["Amazon US", "Walmart", ...],
  "UK": ["Collectors Amazon", "Argos Instore", ...],
  "CA": ["Amazon CA", ...]
}
```

#### 2. Get Feed
```
GET /v1/feed?user_id={userId}&country={country}&category={category}&offset={offset}&limit={limit}

Response: [
  {
    id: "message_id",
    category_name: "Collectors Amazon",
    country_code: "UK",
    is_locked: false,
    created_at: "2024-01-31T...",
    product_data: {
      title: "Product Title",
      price: "49.99",
      resell: "99.99",
      roi: "100",
      image: "https://...",
      buy_url: "https://..."
    }
  }
]
```

#### 3. User Status
```
GET /v1/user/status?user_id={userId}

Response: {
  views_used: 2,
  views_limit: 4
}
```

---

## 🎨 Design System

### Brand Colors (Constants.js)
```javascript
BRAND: {
  BLUE: '#2D82FF',      // Primary action color
  PURPLE: '#9B4DFF',    // Secondary accent
  DARK_BG: '#0A0A0B',   // Dark mode background
  LIGHT_BG: '#F8F9FE'   // Light mode background
}
```

### Typography Scale
```javascript
// Headers
fontSize: 24, fontWeight: '900'  // Page titles
fontSize: 22, fontWeight: '900'  // Card titles
fontSize: 17, fontWeight: '900'  // Section titles

// Body
fontSize: 15, fontWeight: '700'  // Main text
fontSize: 14, fontWeight: '600'  // Secondary text
fontSize: 13, fontWeight: '600'  // Tertiary text

// Labels
fontSize: 11, fontWeight: '800'  // Small labels
fontSize: 10, fontWeight: '900'  // Tiny labels with spacing
```

### Spacing System
```javascript
// Sections
marginBottom: 28px    // Between major sections
marginBottom: 20px    // Between cards
marginBottom: 14px    // Between title and content

// Padding
paddingHorizontal: 20px
paddingHorizontal: 16px
paddingVertical: 12-16px
```

### Shadow System
```javascript
// Small (subtle separators)
shadowOpacity: 0.05, shadowRadius: 4, elevation: 1

// Medium (cards)
shadowOpacity: 0.08-0.12, shadowRadius: 8-12, elevation: 3-5

// Large (floating elements)
shadowOpacity: 0.15-0.3, shadowRadius: 12-20, elevation: 8-10
```

---

## 🔄 State Management

### Context: SavedContext.js
```javascript
{
  savedDeals: Set<id>,
  toggleSave: (product) => void,
  isSaved: (id) => boolean
}
```

**Usage**:
```javascript
const { toggleSave, isSaved } = useContext(SavedContext);
const saved = isSaved(product.id);
toggleSave(product);
```

---

## 📦 Dependencies

```json
{
  "@react-navigation/bottom-tabs": "^7.10.1",
  "@react-navigation/native": "^7.1.28",
  "@react-navigation/native-stack": "^7.11.0",
  "expo": "~54.0.32",
  "expo-blur": "~15.0.8",
  "expo-linear-gradient": "~14.0.1",     // NEW: Gradient support
  "expo-status-bar": "~3.0.9",
  "react-native": "0.81.5",
  "react-native-safe-area-context": "~5.6.0"
}
```

---

## 🚀 Running the App

### Development
```bash
cd hollowscan_app
npm install
npm start
```

### With Tunnel (Remote Access)
```bash
npx expo start --tunnel
```

### On Physical Device
1. Download Expo Go app
2. Scan QR code from terminal
3. App opens on your device

---

## 🔧 Customization Guide

### Change Colors
Edit `Constants.js`:
```javascript
BRAND: {
  BLUE: '#NEW_COLOR',
  PURPLE: '#NEW_COLOR'
}
```

### Adjust Spacing
Edit individual screen files, look for `marginBottom`, `paddingHorizontal`, etc.

### Modify Typography
Search for `fontSize`, `fontWeight` in screen files and update values.

### Add New Features
1. Create new screen in `screens/`
2. Add to bottom tab navigator in `App.js`
3. Import and configure routing

---

## 📝 Common Tasks

### Add a New API Call
```javascript
const fetchData = async () => {
  try {
    const response = await fetch(`${Constants.API_BASE_URL}/v1/endpoint`);
    const data = await response.json();
    setData(data);
  } catch (e) {
    console.log("Error:", e);
  }
};
```

### Create a New Card Component
1. Create `components/ProductCard.js`
2. Accept `{ product, onPress }` as props
3. Export and use in screen

### Modify Colors for Dark Mode
Check `isDarkMode` variable and apply conditional colors:
```javascript
const colors = isDarkMode ? { ... } : { ... };
```

---

## 🐛 Troubleshooting

### Categories Not Loading
- Check API is running: `http://10.246.149.243:8000/v1/categories`
- Verify `channels.json` is populated in Discord backend
- Check network connectivity

### Images Not Loading
- Verify product image URLs are valid
- Check CORS if fetching from external sources
- Use `https://via.placeholder.com/400` as fallback

### Modal Not Appearing
- Ensure `setFilterVisible(true)` is called
- Check TouchableOpacity onPress handler
- Verify Modal visibility state

---

## 📚 Resources

- [React Native Docs](https://reactnative.dev)
- [Expo Documentation](https://docs.expo.dev)
- [React Navigation](https://reactnavigation.org)
- [expo-linear-gradient](https://docs.expo.dev/versions/latest/sdk/linear-gradient/)

---

**Last Updated**: January 31, 2026
