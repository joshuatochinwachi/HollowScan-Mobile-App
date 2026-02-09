# Category Filter - Database Query Verification

## Changes Made to Fix Category Filtering

### 1. **API Endpoint (`main_api.py` - Line 447-451)**
**Before:**
```python
# Apply category filter (case-insensitive)
if category and category.upper() != "ALL":
    if category.upper() not in product["category_name"].upper():
        continue
```

**After:**
```python
# Apply category filter (exact match on store name, case-insensitive)
if category and category.strip():  # If category is provided and not empty
    # Exact match comparison (case-insensitive)
    if product["category_name"].upper().strip() != category.upper().strip():
        continue
```

**Why:** Exact matching is more reliable than substring matching and handles whitespace properly.

### 2. **URL Encoding in App (`HomeScreen.js` - Line 135)**
**Before:**
```javascript
const url = `${Constants.API_BASE_URL}/v1/feed?...&category=${catParam}&...`;
```

**After:**
```javascript
const url = `${Constants.API_BASE_URL}/v1/feed?...&category=${encodeURIComponent(catParam)}&...`;
```

**Why:** Properly encodes category names with spaces (e.g., "Collectors Amazon" → "Collectors%20Amazon")

### 3. **Added Debug Logging**

#### In `fetchCategories()`:
```javascript
console.log('[CATEGORIES] Fetched data:', data);
```
Shows what categories are loaded from the API.

#### In `fetchAlerts()`:
```javascript
console.log('[FETCH] Sending request to:', url);
console.log('[FETCH] Selected categories:', selectedCategories);
console.log('[FETCH] Response data count:', Array.isArray(data) ? data.length : 'Not array');
```
Shows exactly what's being sent to the API and how many results come back.

#### In `useEffect` (Line ~187):
```javascript
console.log('[CATEGORIES] Available for', selectedRegion, ':', currentSubcategories);
```
Shows which categories are available for the selected region.

## How to Verify It Works

1. **Open the app and check Console:**
   - Look for `[CATEGORIES] Fetched data:` - should show the structure
   - Look for `[CATEGORIES] Available for US:` - should show store names
   
2. **Select a Category and Check Console:**
   - Look for `[FETCH] Sending request to:` - URL should have proper encoding
   - Look for `[FETCH] Response data count:` - should return filtered results
   
3. **Test Multiple Categories:**
   - Select different categories for different regions
   - Verify the feed updates with correct products

## Expected Data Flow

1. App loads → `/v1/categories` returns `{US: ["Collectors Amazon", "Argos Instore", ...], UK: [...], CA: [...]}`
2. User selects category → `selectedCategories` state updates
3. App fetches feed → `/v1/feed?country=US&category=Collectors%20Amazon`
4. API filters messages where `product["category_name"] == "Collectors Amazon"` (case-insensitive)
5. Returns only products from that store

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| No categories showing | Check console for `[CATEGORIES] Fetched data:` - if empty, API might be failing |
| Selection not filtering | Check `[FETCH] Sending request to:` - verify category name is correct |
| Wrong products returned | API filter now uses exact matching - verify store names match exactly |
| Spaces in category names | Now using `encodeURIComponent()` to handle spaces properly |

