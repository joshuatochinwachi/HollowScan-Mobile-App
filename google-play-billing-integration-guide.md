# Google Play Billing Integration Guide for HollowScan
## Complete Implementation Guide with React Native & Expo

---

## 📋 Table of Contents

1. [Project Context](#project-context)
2. [Current System Overview](#current-system-overview)
3. [Implementation Strategy](#implementation-strategy)
4. [Phase 1: Google Play Console Setup](#phase-1-google-play-console-setup)
5. [Phase 2: Code Implementation](#phase-2-code-implementation)
6. [Phase 3: Backend Integration](#phase-3-backend-integration)
7. [Phase 4: Testing](#phase-4-testing)
8. [Phase 5: Migration Strategy](#phase-5-migration-strategy)
9. [Important Notes](#important-notes)

---

## 📱 Project Context

### App Information
- **App Name:** HollowScan
- **Package Name:** com.kttylabs.app
- **Platform:** React Native with Expo
- **Backend:** FastAPI (Python) on Railway
- **Database:** Supabase
- **Current Status:** Live on Google Play Store (production access granted)

### Current Subscription System
- **External subscription:** Via Telegram bot
- **Premium features unlocked:** When users link Telegram account
- **Backend verification:** Checks Telegram subscription status via `bot_users.json`
- **Firebase:** Already configured (FCM credentials added for push notifications)

### Business Requirements
- **Free tier:** Limited access, basic features
- **Premium tier:** Unlimited deals, all regions, push notifications, advanced filtering
- **Pricing model:** Monthly and/or Yearly subscriptions
- **Migration:** Gradually transition from Telegram to Google Play Billing

---

## 🎯 Current System Overview

### Backend Structure (FastAPI)

**Key Files:**
- `app.py` - Main backend application
- `supabase_utils.py` - Database utilities
- Database tables:
  - `users` - User accounts with subscription status
  - `user_telegram_links` - Links between app users and Telegram accounts
  - `saved_deals` - User saved deals

**Relevant Database Fields in `users` table:**
```python
{
    "id": "uuid",
    "email": "string",
    "subscription_status": "free" | "active",
    "subscription_end": "timestamp",
    "subscription_source": "telegram" | "google_play" | null,
    "push_tokens": ["array of Expo push tokens"]
}
```

**Current Premium Verification Logic:**
```python
async def verify_premium_status(user_id: str, user_data: Dict = None) -> bool:
    # Checks subscription_status == "active"
    # Checks subscription_end > now()
    # If source == "telegram", verifies Telegram link exists
    # Returns True if premium, False if free
```

### Frontend Structure (React Native/Expo)

**Tech Stack:**
- React Native
- Expo
- TypeScript (likely)
- Navigation (React Navigation)
- State management (likely Context API or Redux)

**Key Screens/Components:**
- Settings/Profile screen (has account deletion)
- Feed/Browse screen (shows deals)
- Premium/Subscription screen (needs to be created/updated)

---

## 🚀 Implementation Strategy

### Phase 1: Google Play Console Setup (No Code)
1. Set up merchant account
2. Create subscription products
3. Configure pricing
4. Set up API access
5. Enable Real-Time Developer Notifications

### Phase 2: Frontend Implementation
1. Install and configure react-native-iap
2. Create subscription UI
3. Implement purchase flow
4. Add subscription management
5. Handle edge cases

### Phase 3: Backend Implementation
1. Add Google Play API verification
2. Create purchase verification endpoint
3. Handle Real-Time Developer Notifications
4. Update user subscription status
5. Add webhook for subscription events

### Phase 4: Testing
1. Test with license testers
2. Verify purchase flow
3. Test backend verification
4. Test subscription management
5. Test edge cases

### Phase 5: Production Migration
1. Release update with Google Play Billing
2. Keep Telegram system running
3. Gradually migrate users
4. Monitor metrics
5. Eventually phase out Telegram

---

## 📋 Phase 1: Google Play Console Setup

### Step 1: Set Up Merchant Account

**⚠️ CRITICAL:** You cannot sell subscriptions without this.

1. **Navigate to Payments Profile**
   - Go to [Google Play Console](https://play.google.com/console)
   - Sidebar: **Setup** → **Payments profile**
   - Click **"Create payments profile"**

2. **Provide Information**
   - Account type: Individual or Business
   - Legal name (must match ID)
   - Address
   - Phone number
   - Email for notifications

3. **Add Tax Information**
   - **US Developers:** SSN/EIN + W-9 form
   - **Non-US Developers:** Tax ID + W-8BEN/W-8BEN-E form

4. **Add Bank Account**
   - Bank name
   - Account holder name (must match registered name)
   - Account number/IBAN
   - Routing number/SWIFT code
   - Bank address

5. **Wait for Verification**
   - Takes 1-3 business days
   - You'll receive email confirmation
   - **Cannot activate subscriptions until approved**

### Step 2: Create Subscription Products

1. **Navigate to Subscriptions**
   - Select HollowScan app
   - Sidebar: **Monetize** → **Subscriptions**
   - Click **"Create subscription"**

2. **Create Monthly Subscription**
   - **Product ID:** `premium_monthly` (CANNOT CHANGE LATER!)
   - **Name:** "Premium Monthly"
   - **Description:** "Unlimited deals, all regions, push notifications"
   - Click **"Create"**

3. **Add Base Plan**
   - Click **"Add base plan"**
   - **Base plan ID:** `monthly-standard` (CANNOT CHANGE LATER!)
   - **Billing period:** Monthly
   - **Renewal type:** Auto-renewing
   - **Price:** Set in your currency (e.g., $9.99)
   - Click **"Apply prices to other countries"** (auto-converts)
   - **Grace period:** 7 days (recommended)
   - **Account hold:** Enable (recommended)
   - Click **"Save"**

4. **Add Free Trial Offer (Recommended)**
   - Under base plan, click **"Add offer"**
   - **Offer ID:** `trial-7day`
   - **Offer name:** "7-Day Free Trial"
   - **Phase 1:** Duration 7 days, Price $0.00
   - **Phase 2:** Auto-inherits base plan price
   - **Eligibility:** New customers only
   - Click **"Save"**

5. **Create Yearly Subscription (Optional)**
   - Repeat steps 2-4
   - **Product ID:** `premium_yearly`
   - **Name:** "Premium Yearly"
   - **Billing period:** Yearly
   - **Price:** Discounted annual rate (e.g., $99.99 instead of $119.88)

6. **Activate Products**
   - Click **"Activate"** on each product
   - Confirm activation
   - Products are now live

**⚠️ Important Product IDs:**
```javascript
// These EXACT strings must be used in your code
const SUBSCRIPTION_SKUS = {
  monthly: 'premium_monthly',
  yearly: 'premium_yearly', // if you create it
};
```

### Step 3: Set Up API Access for Backend

1. **Go to Google Cloud Console**
   - Visit [https://console.cloud.google.com](https://console.cloud.google.com)
   - Sign in with same Google account

2. **Create New Project**
   - Project name: "HollowScan Backend" (or similar)
   - Click **"Create"**
   - Select the project

3. **Enable Google Play Developer API**
   - Navigation menu → **APIs & Services** → **Library**
   - Search "Google Play Android Developer API"
   - Click **"Enable"**

4. **Create Service Account**
   - Navigation menu → **IAM & Admin** → **Service Accounts**
   - Click **"Create Service Account"**
   - **Name:** "play-billing-verifier"
   - **Description:** "Verifies subscription purchases"
   - Click **"Create and Continue"**
   - Skip permissions (granted in Play Console)
   - Click **"Done"**

5. **Create Service Account Key**
   - Click on service account email
   - **Keys** tab → **Add Key** → **Create new key**
   - Select **JSON**
   - Click **"Create"**
   - **JSON file downloads** - KEEP THIS SECURE!
   - Rename to: `hollowscan-play-billing-key.json`

6. **Link Service Account to Play Console**
   - Go back to [Play Console](https://play.google.com/console)
   - **Setup** → **API access**
   - Click **"Link"** next to Cloud project (if not linked)
   - Find service account in list
   - Click **"Grant access"** or **"Manage Play Console permissions"**
   - **Permissions:**
     - ✅ View financial data
     - ✅ Manage orders and subscriptions
   - Click **"Invite user"** / **"Save"**

### Step 4: Set Up Real-Time Developer Notifications

1. **Create Pub/Sub Topic**
   - In Cloud Console: **Pub/Sub** → **Topics**
   - Click **"Create Topic"**
   - **Topic ID:** `play-billing-notifications`
   - Click **"Create"**

2. **Grant Google Play Permission**
   - Click on topic → **Permissions** tab
   - Click **"Add Principal"**
   - **New principals:** `google-play-developer-notifications@system.gserviceaccount.com`
   - **Role:** "Pub/Sub Publisher"
   - Click **"Save"**

3. **Create Subscription (for receiving messages)**
   - **Subscriptions** → **Create Subscription**
   - **Subscription ID:** `play-notifications-sub`
   - **Topic:** Select your topic
   - **Delivery type:** 
     - **Push** (if webhook ready): Your backend URL
     - **Pull** (for now): Your backend will poll
   - Click **"Create"**

4. **Configure in Play Console**
   - Play Console → **Monetize** → **Monetization setup**
   - **Real-time developer notifications** section
   - **Topic name:** `projects/YOUR_PROJECT_ID/topics/play-billing-notifications`
   - Click **"Send test notification"**
   - Click **"Save"**

**Topic Name Format:**
```
projects/{your-cloud-project-id}/topics/play-billing-notifications
```

---

## 💻 Phase 2: Code Implementation (Frontend)

### Step 1: Install Dependencies

```bash
# Install react-native-iap
npm install react-native-iap

# OR
yarn add react-native-iap

# Rebuild the app
eas build --platform android --profile production
```

### Step 2: Create Subscription Configuration

**File:** `src/config/subscriptions.ts`

```typescript
// Subscription Product IDs (must match Google Play Console EXACTLY)
export const SUBSCRIPTION_SKUS = {
  MONTHLY: 'premium_monthly',
  YEARLY: 'premium_yearly', // if you created it
} as const;

// Subscription offer IDs (for free trials)
export const SUBSCRIPTION_OFFERS = {
  MONTHLY_TRIAL: 'premium_monthly:monthly-standard:trial-7day',
} as const;

export interface SubscriptionPlan {
  productId: string;
  title: string;
  description: string;
  features: string[];
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    productId: SUBSCRIPTION_SKUS.MONTHLY,
    title: 'Premium Monthly',
    description: 'Full access to all features',
    features: [
      'Unlimited deal access',
      'All regions (US, UK, Canada)',
      'Real-time push notifications',
      'Advanced search & filters',
      'Priority support',
    ],
    popular: true,
  },
  // Add yearly if you created it
];
```

### Step 3: Create Subscription Service

**File:** `src/services/SubscriptionService.ts`

```typescript
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  Purchase,
  PurchaseError,
  SubscriptionPurchase,
  finishTransaction,
  getAvailablePurchases,
} from 'react-native-iap';
import { Platform } from 'react-native';
import { SUBSCRIPTION_SKUS } from '../config/subscriptions';

class SubscriptionService {
  private isInitialized = false;

  /**
   * Initialize IAP connection
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;
      
      const connected = await initConnection();
      console.log('[IAP] Connection initialized:', connected);
      this.isInitialized = true;
    } catch (error) {
      console.error('[IAP] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Clean up IAP connection
   * Call this on app shutdown
   */
  async cleanup(): Promise<void> {
    try {
      await endConnection();
      this.isInitialized = false;
      console.log('[IAP] Connection ended');
    } catch (error) {
      console.error('[IAP] Failed to end connection:', error);
    }
  }

  /**
   * Get available subscription products with prices
   */
  async getProducts() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const skus = Object.values(SUBSCRIPTION_SKUS);
      const products = await getSubscriptions({ skus });
      
      console.log('[IAP] Products loaded:', products);
      return products;
    } catch (error) {
      console.error('[IAP] Failed to get products:', error);
      throw error;
    }
  }

  /**
   * Purchase a subscription
   * @param productId - Subscription SKU
   * @param offerToken - Optional offer token for free trials
   */
  async purchaseSubscription(
    productId: string,
    offerToken?: string
  ): Promise<SubscriptionPurchase> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log('[IAP] Requesting purchase:', productId, offerToken);

      const purchase = await requestSubscription({
        sku: productId,
        ...(Platform.OS === 'android' && offerToken && {
          subscriptionOffers: [{ sku: productId, offerToken }],
        }),
      });

      console.log('[IAP] Purchase successful:', purchase);
      return purchase as SubscriptionPurchase;
    } catch (error) {
      const purchaseError = error as PurchaseError;
      console.error('[IAP] Purchase failed:', purchaseError);
      
      if (purchaseError.code === 'E_USER_CANCELLED') {
        throw new Error('Purchase cancelled');
      }
      
      throw new Error(purchaseError.message || 'Purchase failed');
    }
  }

  /**
   * Restore previous purchases
   * Important for users reinstalling the app
   */
  async restorePurchases(): Promise<Purchase[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const purchases = await getAvailablePurchases();
      console.log('[IAP] Restored purchases:', purchases);
      
      return purchases;
    } catch (error) {
      console.error('[IAP] Failed to restore purchases:', error);
      throw error;
    }
  }

  /**
   * Acknowledge a purchase (required to complete transaction)
   * @param purchase - Purchase object from purchase flow
   */
  async acknowledgePurchase(purchase: Purchase): Promise<void> {
    try {
      await finishTransaction({ purchase, isConsumable: false });
      console.log('[IAP] Purchase acknowledged:', purchase.productId);
    } catch (error) {
      console.error('[IAP] Failed to acknowledge purchase:', error);
      throw error;
    }
  }
}

export default new SubscriptionService();
```

### Step 4: Create Subscription Context

**File:** `src/contexts/SubscriptionContext.tsx`

```typescript
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  Purchase,
  Subscription,
  purchaseErrorListener,
  purchaseUpdatedListener,
  PurchaseError,
} from 'react-native-iap';
import SubscriptionService from '../services/SubscriptionService';
import { verifyPurchaseWithBackend } from '../api/subscriptionApi';

interface SubscriptionContextValue {
  products: Subscription[];
  loading: boolean;
  isPremium: boolean;
  currentSubscription: Purchase | null;
  purchaseSubscription: (productId: string, offerToken?: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<Purchase | null>(null);

  // Initialize IAP and load products
  useEffect(() => {
    initializeIAP();
    return () => {
      SubscriptionService.cleanup();
    };
  }, []);

  // Listen for purchase updates
  useEffect(() => {
    const purchaseUpdateSubscription = purchaseUpdatedListener(handlePurchaseUpdate);
    const purchaseErrorSubscription = purchaseErrorListener(handlePurchaseError);

    return () => {
      purchaseUpdateSubscription.remove();
      purchaseErrorSubscription.remove();
    };
  }, []);

  async function initializeIAP() {
    try {
      setLoading(true);
      await SubscriptionService.initialize();
      
      // Load available products
      const availableProducts = await SubscriptionService.getProducts();
      setProducts(availableProducts);

      // Check existing subscription status
      await refreshSubscriptionStatus();
    } catch (error) {
      console.error('[Subscription] Initialization failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchaseUpdate(purchase: Purchase) {
    console.log('[Subscription] Purchase updated:', purchase);

    try {
      // Send purchase receipt to backend for verification
      const verified = await verifyPurchaseWithBackend(purchase);

      if (verified) {
        // Acknowledge purchase with Google
        await SubscriptionService.acknowledgePurchase(purchase);
        
        // Update local state
        setIsPremium(true);
        setCurrentSubscription(purchase);
        
        console.log('[Subscription] Purchase verified and acknowledged');
      } else {
        console.error('[Subscription] Purchase verification failed');
      }
    } catch (error) {
      console.error('[Subscription] Error processing purchase:', error);
    }
  }

  function handlePurchaseError(error: PurchaseError) {
    console.error('[Subscription] Purchase error:', error);
    // Handle error in UI
  }

  const purchaseSubscription = useCallback(
    async (productId: string, offerToken?: string) => {
      try {
        setLoading(true);
        await SubscriptionService.purchaseSubscription(productId, offerToken);
        // handlePurchaseUpdate will be called automatically
      } catch (error) {
        console.error('[Subscription] Purchase failed:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const restorePurchases = useCallback(async () => {
    try {
      setLoading(true);
      const purchases = await SubscriptionService.restorePurchases();

      if (purchases.length > 0) {
        // Verify each purchase with backend
        for (const purchase of purchases) {
          await handlePurchaseUpdate(purchase);
        }
      }
    } catch (error) {
      console.error('[Subscription] Restore failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSubscriptionStatus = useCallback(async () => {
    try {
      const purchases = await SubscriptionService.restorePurchases();
      
      // Find active subscription
      const activeSubscription = purchases.find(
        (p) => Object.values(SUBSCRIPTION_SKUS).includes(p.productId)
      );

      if (activeSubscription) {
        setCurrentSubscription(activeSubscription);
        setIsPremium(true);
      } else {
        setCurrentSubscription(null);
        setIsPremium(false);
      }
    } catch (error) {
      console.error('[Subscription] Status refresh failed:', error);
    }
  }, []);

  const value: SubscriptionContextValue = {
    products,
    loading,
    isPremium,
    currentSubscription,
    purchaseSubscription,
    restorePurchases,
    refreshSubscriptionStatus,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}
```

### Step 5: Create Subscription UI Screen

**File:** `src/screens/SubscriptionScreen.tsx`

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useSubscription } from '../contexts/SubscriptionContext';
import { SUBSCRIPTION_PLANS } from '../config/subscriptions';

export function SubscriptionScreen() {
  const {
    products,
    loading,
    isPremium,
    purchaseSubscription,
    restorePurchases,
  } = useSubscription();

  const [purchasing, setPurchasing] = useState(false);

  async function handlePurchase(productId: string) {
    try {
      setPurchasing(true);
      await purchaseSubscription(productId);
      Alert.alert('Success', 'Welcome to Premium!');
    } catch (error) {
      if (error.message !== 'Purchase cancelled') {
        Alert.alert('Error', 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    try {
      setPurchasing(true);
      await restorePurchases();
      Alert.alert('Success', 'Purchases restored!');
    } catch (error) {
      Alert.alert('Error', 'No purchases found to restore.');
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isPremium) {
    return (
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
          You're Premium! 🎉
        </Text>
        <Text>Manage your subscription in Google Play Store</Text>
        <TouchableOpacity
          style={{
            backgroundColor: '#007AFF',
            padding: 15,
            borderRadius: 10,
            marginTop: 20,
          }}
          onPress={() => {
            // Open Play Store subscription management
            // Linking.openURL('https://play.google.com/store/account/subscriptions');
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Manage Subscription
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 10 }}>
        Upgrade to Premium
      </Text>
      <Text style={{ fontSize: 16, color: '#666', marginBottom: 30 }}>
        Unlock all features and get the most out of HollowScan
      </Text>

      {SUBSCRIPTION_PLANS.map((plan) => {
        const product = products.find((p) => p.productId === plan.productId);
        
        return (
          <View
            key={plan.productId}
            style={{
              backgroundColor: plan.popular ? '#007AFF10' : '#F5F5F5',
              padding: 20,
              borderRadius: 15,
              marginBottom: 20,
              borderWidth: plan.popular ? 2 : 0,
              borderColor: '#007AFF',
            }}
          >
            {plan.popular && (
              <View
                style={{
                  position: 'absolute',
                  top: -10,
                  right: 20,
                  backgroundColor: '#007AFF',
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                  MOST POPULAR
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 5 }}>
              {plan.title}
            </Text>
            
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#007AFF', marginBottom: 15 }}>
              {product?.localizedPrice || 'Loading...'}
            </Text>

            {plan.features.map((feature, index) => (
              <Text key={index} style={{ fontSize: 14, marginBottom: 8 }}>
                ✓ {feature}
              </Text>
            ))}

            <TouchableOpacity
              style={{
                backgroundColor: '#007AFF',
                padding: 15,
                borderRadius: 10,
                marginTop: 15,
              }}
              onPress={() => handlePurchase(plan.productId)}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
                  Start 7-Day Free Trial
                </Text>
              )}
            </TouchableOpacity>

            <Text style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 10 }}>
              Cancel anytime. Auto-renews at {product?.localizedPrice}/month after trial.
            </Text>
          </View>
        );
      })}

      <TouchableOpacity
        style={{ padding: 15, marginTop: 20 }}
        onPress={handleRestore}
      >
        <Text style={{ color: '#007AFF', textAlign: 'center', fontSize: 16 }}>
          Restore Purchases
        </Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 20 }}>
        By subscribing, you agree to our Terms of Service and Privacy Policy.
        Subscriptions auto-renew unless canceled 24 hours before the end of the current period.
      </Text>
    </ScrollView>
  );
}
```

### Step 6: Add to Navigation

**Example integration in your navigation:**

```typescript
// In your navigator file
import { SubscriptionScreen } from './screens/SubscriptionScreen';

// Add to your stack/tab navigator
<Stack.Screen 
  name="Subscription" 
  component={SubscriptionScreen}
  options={{ title: 'Premium' }}
/>
```

### Step 7: Wrap App with Provider

**File:** `App.tsx` or your root component

```typescript
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';

export default function App() {
  return (
    <SubscriptionProvider>
      {/* Your existing app structure */}
      <NavigationContainer>
        {/* ... */}
      </NavigationContainer>
    </SubscriptionProvider>
  );
}
```

---

## 🔧 Phase 3: Backend Integration

### Step 1: Install Dependencies

```bash
pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

Add to `requirements.txt`:
```
google-auth==2.23.0
google-auth-oauthlib==1.1.0
google-auth-httplib2==0.1.1
google-api-python-client==2.100.0
```

### Step 2: Add Service Account Key to Railway

1. Upload `hollowscan-play-billing-key.json` to Railway
2. Or add as environment variable:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
   # OR as JSON string
   GOOGLE_SERVICE_ACCOUNT_JSON='{"type": "service_account", ...}'
   ```

### Step 3: Create Google Play API Client

**File:** `google_play_api.py`

```python
import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/androidpublisher']
PACKAGE_NAME = 'com.kttylabs.app'

def get_google_play_service():
    """Initialize Google Play Developer API service"""
    
    # Load service account credentials
    if os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
        credentials = service_account.Credentials.from_service_account_file(
            os.getenv('GOOGLE_APPLICATION_CREDENTIALS'),
            scopes=SCOPES
        )
    elif os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON'):
        service_account_info = json.loads(os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON'))
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=SCOPES
        )
    else:
        raise ValueError("No Google service account credentials found")
    
    # Build API service
    service = build('androidpublisher', 'v3', credentials=credentials)
    return service

async def verify_subscription_purchase(
    product_id: str,
    purchase_token: str
) -> dict:
    """
    Verify a subscription purchase with Google Play API
    
    Args:
        product_id: Subscription product ID (e.g., 'premium_monthly')
        purchase_token: Purchase token from client
        
    Returns:
        dict with subscription details or None if invalid
    """
    try:
        service = get_google_play_service()
        
        # Call Google Play API
        result = service.purchases().subscriptionsv2().get(
            packageName=PACKAGE_NAME,
            token=purchase_token
        ).execute()
        
        print(f"[Google Play API] Subscription verified: {result}")
        return result
        
    except Exception as e:
        print(f"[Google Play API] Verification failed: {e}")
        return None

async def acknowledge_subscription_purchase(
    product_id: str,
    purchase_token: str
) -> bool:
    """
    Acknowledge a subscription purchase
    Required within 3 days or purchase will be refunded
    
    Args:
        product_id: Subscription product ID
        purchase_token: Purchase token from client
        
    Returns:
        True if acknowledged successfully
    """
    try:
        service = get_google_play_service()
        
        service.purchases().subscriptions().acknowledge(
            packageName=PACKAGE_NAME,
            subscriptionId=product_id,
            token=purchase_token,
            body={}
        ).execute()
        
        print(f"[Google Play API] Purchase acknowledged: {product_id}")
        return True
        
    except Exception as e:
        print(f"[Google Play API] Acknowledgment failed: {e}")
        return False
```

### Step 4: Add Purchase Verification Endpoint

**Add to `app.py`:**

```python
from google_play_api import verify_subscription_purchase, acknowledge_subscription_purchase
from datetime import datetime, timezone

@app.post("/v1/subscriptions/verify")
async def verify_subscription(
    user_id: str,
    product_id: str,
    purchase_token: str,
    background_tasks: BackgroundTasks
):
    """
    Verify and process a Google Play subscription purchase
    """
    try:
        # Verify with Google Play API
        subscription_data = await verify_subscription_purchase(product_id, purchase_token)
        
        if not subscription_data:
            raise HTTPException(status_code=400, detail="Invalid purchase token")
        
        # Extract subscription details
        # Note: API v2 response structure
        subscription_state = subscription_data.get('subscriptionState')
        expiry_time = subscription_data.get('lineItems', [{}])[0].get('expiryTime')
        
        # Check if subscription is active
        is_active = subscription_state in ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD']
        
        if not is_active:
            raise HTTPException(status_code=400, detail="Subscription not active")
        
        # Update user in database
        expiry_datetime = datetime.fromisoformat(expiry_time.replace('Z', '+00:00'))
        
        update_data = {
            "subscription_status": "active",
            "subscription_end": expiry_datetime.isoformat(),
            "subscription_source": "google_play",
            "google_play_purchase_token": purchase_token,
            "google_play_product_id": product_id,
        }
        
        success = await update_user(user_id, update_data)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update user")
        
        # Acknowledge purchase in background (required within 3 days)
        background_tasks.add_task(
            acknowledge_subscription_purchase,
            product_id,
            purchase_token
        )
        
        print(f"[Subscription] Verified for user {user_id}: {product_id}")
        
        return {
            "success": True,
            "message": "Subscription verified",
            "subscription_end": expiry_datetime.isoformat(),
            "product_id": product_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Subscription] Verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Step 5: Add Real-Time Notification Webhook

**Add to `app.py`:**

```python
import base64

@app.post("/v1/webhooks/google-play-billing")
async def google_play_billing_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Handle Real-Time Developer Notifications from Google Play
    """
    try:
        # Parse Pub/Sub message
        body = await request.json()
        message = body.get('message', {})
        data = message.get('data')
        
        if not data:
            return {"success": True}  # Acknowledge empty messages
        
        # Decode base64 data
        decoded_data = base64.b64decode(data).decode('utf-8')
        notification = json.loads(decoded_data)
        
        print(f"[Google Play Webhook] Received: {notification}")
        
        # Extract notification details
        subscription_notification = notification.get('subscriptionNotification', {})
        notification_type = subscription_notification.get('notificationType')
        purchase_token = subscription_notification.get('purchaseToken')
        subscription_id = subscription_notification.get('subscriptionId')
        
        # Process notification in background
        background_tasks.add_task(
            process_subscription_notification,
            notification_type,
            purchase_token,
            subscription_id
        )
        
        # Acknowledge receipt
        return {"success": True}
        
    except Exception as e:
        print(f"[Google Play Webhook] Error: {e}")
        return {"success": False, "error": str(e)}

async def process_subscription_notification(
    notification_type: int,
    purchase_token: str,
    subscription_id: str
):
    """
    Process different types of subscription notifications
    """
    try:
        # Notification types:
        # 1 = SUBSCRIPTION_RECOVERED
        # 2 = SUBSCRIPTION_RENEWED
        # 3 = SUBSCRIPTION_CANCELED
        # 4 = SUBSCRIPTION_PURCHASED
        # 5 = SUBSCRIPTION_ON_HOLD
        # 6 = SUBSCRIPTION_IN_GRACE_PERIOD
        # 7 = SUBSCRIPTION_RESTARTED
        # 8 = SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
        # 9 = SUBSCRIPTION_DEFERRED
        # 10 = SUBSCRIPTION_PAUSED
        # 11 = SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
        # 12 = SUBSCRIPTION_REVOKED
        # 13 = SUBSCRIPTION_EXPIRED
        
        # Find user by purchase token
        response = await http_client.get(
            f"{URL}/rest/v1/users?google_play_purchase_token=eq.{purchase_token}&select=*",
            headers=HEADERS
        )
        
        if response.status_code != 200 or not response.json():
            print(f"[Notification] User not found for token: {purchase_token}")
            return
        
        user = response.json()[0]
        user_id = user['id']
        
        # Handle different notification types
        if notification_type in [1, 2, 4, 7]:  # Active states
            # Verify current status with API
            subscription_data = await verify_subscription_purchase(subscription_id, purchase_token)
            
            if subscription_data:
                expiry_time = subscription_data.get('lineItems', [{}])[0].get('expiryTime')
                expiry_datetime = datetime.fromisoformat(expiry_time.replace('Z', '+00:00'))
                
                await update_user(user_id, {
                    "subscription_status": "active",
                    "subscription_end": expiry_datetime.isoformat(),
                })
                
                print(f"[Notification] Subscription renewed for user {user_id}")
        
        elif notification_type in [3, 12, 13]:  # Canceled/Revoked/Expired
            await update_user(user_id, {
                "subscription_status": "free",
                "subscription_end": None,
            })
            
            print(f"[Notification] Subscription ended for user {user_id}")
        
        elif notification_type in [5, 6]:  # On hold or grace period
            print(f"[Notification] Subscription in grace/hold for user {user_id}")
            # Keep active but could send warning notification to user
        
    except Exception as e:
        print(f"[Notification] Processing error: {e}")
```

### Step 6: Update Premium Verification

**Modify existing `verify_premium_status` in `app.py`:**

```python
async def verify_premium_status(user_id: str, user_data: Dict = None, background_tasks: BackgroundTasks = None) -> bool:
    """Strictly verify premium status"""
    try:
        if not user_data:
            user_data = await get_user_by_id(user_id)
        if not user_data: return False

        sub_status = user_data.get("subscription_status")
        sub_end = user_data.get("subscription_end")
        sub_source = user_data.get("subscription_source")
        
        is_premium = False
        if sub_status == "active" and sub_end:
            try:
                end_dt = datetime.fromisoformat(sub_end.replace('Z', '+00:00'))
                if end_dt.tzinfo is None: end_dt = end_dt.replace(tzinfo=timezone.utc)
                if end_dt > datetime.now(timezone.utc):
                    is_premium = True
            except: pass

        # Verify Telegram subscriptions (existing logic)
        if is_premium and sub_source == "telegram":
            # ... existing Telegram verification logic ...
            pass
        
        # Verify Google Play subscriptions
        if is_premium and sub_source == "google_play":
            # Optionally verify with Google Play API for extra security
            purchase_token = user_data.get("google_play_purchase_token")
            product_id = user_data.get("google_play_product_id")
            
            if purchase_token and product_id:
                # Verify subscription still valid
                subscription_data = await verify_subscription_purchase(product_id, purchase_token)
                
                if not subscription_data:
                    # Subscription no longer valid, downgrade user
                    is_premium = False
                    if background_tasks:
                        background_tasks.add_task(update_user, user_id, {
                            "subscription_status": "free",
                            "subscription_end": None,
                        })

        return is_premium
    except Exception as e:
        print(f"[Premium Check] Error verifying premium for {user_id}: {e}")
        return False
```

### Step 7: Update Database Schema

Add new columns to `users` table in Supabase:

```sql
ALTER TABLE users 
ADD COLUMN google_play_purchase_token TEXT,
ADD COLUMN google_play_product_id TEXT;

-- Create index for webhook lookups
CREATE INDEX idx_users_google_play_token ON users(google_play_purchase_token);
```

---

## 🧪 Phase 4: Testing

### Step 1: Add License Testers

1. Go to Play Console → **Setup** → **License testing**
2. Add your email and test accounts
3. Choose response: **LICENSED**
4. Click **Save**

### Step 2: Build and Upload to Internal Testing

```bash
# Build new version
eas build --platform android --profile production

# After build completes
eas submit --platform android
```

### Step 3: Create Internal Testing Release

1. Play Console → **Testing** → **Internal testing**
2. Create new release
3. Upload AAB from EAS build
4. Add release notes: "Added Google Play Billing"
5. Review and rollout

### Step 4: Install and Test

1. Get opt-in URL from internal testing
2. Accept invitation
3. Install app from Play Store
4. Test purchase flow:
   - View subscription products
   - Initiate purchase
   - Complete payment (won't be charged as license tester)
   - Verify premium features unlock
   - Check backend logs

### Step 5: Test Subscription Management

1. Cancel subscription in Play Store
2. Verify app shows "Active until [date]"
3. Wait for expiration
4. Verify features lock after expiration
5. Test re-subscription

### Step 6: Test Restore Purchases

1. Uninstall app
2. Reinstall from Play Store
3. Open app
4. Tap "Restore Purchases"
5. Verify subscription restored

---

## 🔄 Phase 5: Migration Strategy

### Week 1-2: Soft Launch

1. Release app update with Google Play Billing
2. Keep Telegram system fully functional
3. Add banner in app: "New: Subscribe via Google Play!"
4. Monitor metrics:
   - Google Play purchases vs Telegram
   - Conversion rates
   - Backend errors
   - User feedback

### Week 3-4: Encourage Migration

1. Add incentive: "Switch to Google Play, get 1 month free!"
2. Show comparison in settings:
   - ✅ Google Play: Seamless, secure, managed by Google
   - ⚠️ Telegram: Requires account linking
3. Allow dual subscriptions temporarily
4. Monitor migration rate

### Month 2-3: Phase Out Telegram

1. Stop accepting new Telegram subscriptions
2. Grandfather existing Telegram subscribers
3. Send notifications: "Please switch to Google Play"
4. Set end date for Telegram support

### Month 4+: Google Play Only

1. Remove Telegram subscription code
2. Cancel all remaining Telegram subs
3. Full migration complete

### Handling Edge Cases

**User has both subscriptions:**
- Give whichever expires later
- Add logic in `verify_premium_status` to check both

**User refuses to migrate:**
- Allow Telegram until their current period ends
- Then require Google Play

**Refund requests:**
- Direct to Google Play Store support
- Google handles refunds automatically

---

## ⚠️ Important Notes

### Critical Points

1. **Product IDs are permanent** - Choose carefully!
2. **Merchant account MUST be verified** - Cannot sell without it
3. **Test with internal testing** - Sideloaded APKs won't work
4. **Acknowledge purchases within 3 days** - Or auto-refunded
5. **Handle Real-Time Notifications** - Critical for subscription management

### Security Best Practices

1. **Always verify purchases server-side** - Never trust client
2. **Store service account key securely** - Never commit to Git
3. **Use HTTPS for webhooks** - Google requires SSL
4. **Validate Pub/Sub messages** - Check message authenticity
5. **Handle edge cases** - Grace periods, holds, cancellations

### Common Pitfalls

❌ Not setting up merchant account → Cannot activate subscriptions
❌ Wrong product IDs in code → Products won't load
❌ Testing with sideloaded APK → Billing won't work
❌ Not acknowledging purchases → Auto-refunded after 3 days
❌ Ignoring Real-Time Notifications → Subscription status out of sync

### Performance Considerations

- Cache product prices in frontend
- Debounce purchase button clicks
- Add loading states everywhere
- Handle network failures gracefully
- Implement retry logic for backend verification

---

## 📚 Key Environment Variables

Add these to Railway:

```bash
# Google Play API
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
# OR
GOOGLE_SERVICE_ACCOUNT_JSON='{"type": "service_account", ...}'

# Webhook secret (optional but recommended)
GOOGLE_PLAY_WEBHOOK_SECRET=your_secret_here
```

---

## 🔗 Important Links

- **Play Console:** https://play.google.com/console
- **Cloud Console:** https://console.cloud.google.com
- **react-native-iap Docs:** https://react-native-iap.dooboolab.com/
- **Google Play Billing Docs:** https://developer.android.com/google/play/billing

---

## 📞 Need Help?

### Questions to Ask Next AI

1. "Can you help me implement the SubscriptionService in my existing codebase?"
2. "Where should I add the subscription screen in my navigation?"
3. "How do I integrate the backend verification with my existing FastAPI app?"
4. "Can you help me test the purchase flow?"
5. "How do I handle migration from Telegram to Google Play subscriptions?"

### Common Issues

**Products not loading:**
- Check product IDs match exactly
- Verify products are activated in Play Console
- Ensure app installed from Play Store

**Purchase fails:**
- Check license testers configured
- Verify merchant account approved
- Check backend logs for errors

**Backend verification fails:**
- Verify service account permissions
- Check API is enabled
- Validate JSON key file

---

## ✅ Implementation Checklist

### Google Play Console
- [ ] Merchant account set up and verified
- [ ] Subscription products created (`premium_monthly`, etc.)
- [ ] Base plans configured with pricing
- [ ] Free trial offers added
- [ ] Products activated
- [ ] Service account created
- [ ] Service account key downloaded
- [ ] Service account linked to Play Console
- [ ] Real-Time Notifications configured
- [ ] License testers added

### Frontend (React Native)
- [ ] react-native-iap installed
- [ ] SubscriptionService created
- [ ] SubscriptionContext created
- [ ] SubscriptionScreen created
- [ ] Navigation updated
- [ ] App wrapped with SubscriptionProvider
- [ ] Purchase flow tested
- [ ] Restore purchases implemented
- [ ] Error handling added
- [ ] Loading states added

### Backend (FastAPI)
- [ ] Google API client libraries installed
- [ ] google_play_api.py created
- [ ] /v1/subscriptions/verify endpoint added
- [ ] /v1/webhooks/google-play-billing endpoint added
- [ ] process_subscription_notification function added
- [ ] verify_premium_status updated
- [ ] Database schema updated
- [ ] Service account key added to Railway
- [ ] Environment variables configured
- [ ] Backend tested with test purchases

### Testing
- [ ] App uploaded to internal testing
- [ ] Installed from Play Store test link
- [ ] Products load correctly
- [ ] Purchase flow works
- [ ] Backend verification works
- [ ] Webhook receives notifications
- [ ] Subscription status updates
- [ ] Restore purchases works
- [ ] Cancellation flow works
- [ ] Edge cases tested

### Production
- [ ] All tests passed
- [ ] Production build created
- [ ] Released to production
- [ ] Monitoring set up
- [ ] User migration plan in place
- [ ] Support ready for questions

---

## 🎯 Success Criteria

You'll know implementation is successful when:

✅ Users can view subscription products with correct prices
✅ Users can purchase subscriptions successfully
✅ Backend verifies purchases with Google Play API
✅ Subscription status updates in database
✅ Premium features unlock after purchase
✅ Webhooks receive Real-Time Notifications
✅ Users can manage subscriptions in Play Store
✅ Restore purchases works on reinstall
✅ No crashes or errors in production

---

**Good luck with your implementation! 🚀**

This guide should give the next AI everything needed to help you implement Google Play Billing in your HollowScan app successfully.
