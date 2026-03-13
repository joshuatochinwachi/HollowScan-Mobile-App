import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    initConnection,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    purchaseUpdatedListener,
    purchaseErrorListener,
    getAvailablePurchases,
    endConnection
} from 'react-native-iap';
import Constants from '../Constants';

const API_BASE_URL = Constants.API_BASE_URL;

// Subscription product IDs defined in Google Play Console & Apple App Store Connect
const itemSkus = Platform.select({
    ios: ['premium_monthly', 'premium_yearly'], // Apple App Store SKUs
    android: ['premium_monthly', 'premium_yearly'],
});

class SubscriptionService {
    constructor() {
        this.purchaseUpdateSubscription = null;
        this.purchaseErrorSubscription = null;
        this.currentUserId = null;
        this.isConnected = false;
    }

    setCurrentUserId(userId) {
        this.currentUserId = userId;
        console.log('[IAP] User ID set for verification:', userId);
    }

    async initialize() {
        try {
            console.log('[IAP] Initializing connection...');
            const result = await initConnection();
            this.isConnected = true;
            console.log('[IAP] Connection initialized successfully:', result);
        } catch (err) {
            this.isConnected = false;
            console.warn('[IAP] Connection error:', err.code, err.message);
        }
    }

    // Fetches subscription plan details (prices, offer tokens, etc.)
    async getSubscriptions() {
        if (!this.isConnected) {
            console.warn('[IAP] Cannot fetch: Connection not initialized.');
            return [];
        }
        try {
            console.log('[IAP] Fetching subscriptions for SKUs:', itemSkus);
            const products = await fetchProducts({ skus: itemSkus, type: 'subs' });
            
            if (!products || products.length === 0) {
                console.warn('[IAP] No products returned from Google Play. Possible causes: SKUs mismatch, Inactive Base Plan, or Regional restriction.');
            } else {
                console.log('[IAP] Successfully found products:', products.length);
            }
            
            return products || [];
        } catch (err) {
            console.warn('[IAP] Error fetching subscriptions', err);
            return [];
        }
    }

    async requestSubscription(sku) {
        if (!this.isConnected) {
            throw new Error('IAP Connection not initialized. Please try again in safe mode.');
        }
        try {
            console.log('[IAP] Requesting subscription for:', sku);

            if (Platform.OS === 'android') {
                // Fetch the specific product to get its offerToken
                const products = await fetchProducts({ skus: [sku], type: 'subs' });
                console.log(`[IAP] Products returned for ${sku}:`, products?.length || 0);
                
                if (products?.length > 0) {
                    products.forEach(p => console.log(`[IAP] Found Product: ${p.id}, type: ${p.type}`));
                }

                const product = products?.find(p => p.id === sku);

                if (!product) {
                    console.error(`[IAP] CRITICAL: Product ${sku} not found in Google Play.`);
                    throw new Error(`Product "${sku}" not found. Possible causes:
1. Product ID mismatch (check Play Console)
2. Base Plan not "Activated"
3. Account region mismatch
4. App not uploaded to a track (internal/alpha/beta)`);
                }

                // offerToken is required for Android subscriptions in v14
                const offerToken = product.subscriptionOfferDetailsAndroid?.[0]?.offerToken;

                if (!offerToken) {
                    throw new Error(`Offer token not found for ${sku}. Ensure you have an "Activated" Base Plan in the Play Console.`);
                }

                await requestPurchase({
                    type: 'subs',
                    request: {
                        google: {
                            skus: [sku],
                            subscriptionOffers: [{ sku, offerToken }],
                        },
                    },
                });
            } else {
                // iOS
                await requestPurchase({
                    type: 'subs',
                    request: {
                        apple: { sku },
                    },
                });
            }
        } catch (err) {
            console.warn('[IAP] Error requesting subscription', err.code, err.message);
            if (err.code === 'E_USER_CANCELLED') throw new Error('Purchase cancelled');
            throw err;
        }
    }

    async restorePurchases() {
        try {
            console.log('[IAP] Restoring purchases...');
            const purchases = await getAvailablePurchases();
            console.log('[IAP] Available purchases:', purchases.length);

            let restoredCount = 0;
            for (const purchase of purchases) {
            const isVerified = await this.verifyWithBackend(purchase);
                if (isVerified && isVerified.success) {
                    await finishTransaction({ purchase, isConsumable: false });
                    restoredCount++;
                }
            }
            return restoredCount > 0;
        } catch (err) {
            console.warn('[IAP] Restore error', err);
            return false;
        }
    }

    setupPurchaseListeners(onSuccess, onError) {
        this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
            console.log('[IAP] Purchase updated:', purchase.productId);
            // v14: transactionReceipt does not exist — use purchaseToken instead
            const token = purchase.purchaseToken;
            if (token) {
                try {
                    const verificationResponse = await this.verifyWithBackend(purchase);
                    if (verificationResponse && verificationResponse.success) {
                        await finishTransaction({ purchase, isConsumable: false });
                        console.log('[IAP] Transaction finished successfully');
                        onSuccess && onSuccess(purchase, verificationResponse);
                    } else {
                        console.warn('[IAP] Verification failed for:', purchase.productId);
                        onError && onError('Verification failed');
                    }
                } catch (ackErr) {
                    console.warn('[IAP] Ack Error', ackErr);
                    onError && onError(ackErr.message);
                }
            }
        });

        this.purchaseErrorSubscription = purchaseErrorListener((error) => {
            console.warn('[IAP] Purchase Error', error);
            if (error?.code !== 'E_USER_CANCELLED') {
                onError && onError(error.message || 'Purchase failed');
            }
        });
    }

    async verifyWithBackend(purchase) {
        // --- FIX 2: User ID Race Condition Guard ---
        if (!this.currentUserId) {
            console.log('[IAP] currentUserId null, attempting AsyncStorage recovery...');
            try {
                const stored = await AsyncStorage.getItem('user_data');
                if (stored) {
                    const userData = JSON.parse(stored);
                    if (userData && userData.id) {
                        this.currentUserId = userData.id;
                        console.log('[IAP] Recovered user_id from AsyncStorage:', this.currentUserId);
                    }
                }
            } catch (e) {
                console.error('[IAP] User ID recovery failed:', e);
            }
        }

        if (!this.currentUserId) {
            console.error('[IAP] Verification aborted: No user_id available');
            return { success: false, message: 'No user ID' };
        }

        try {
            console.log(`[IAP] Verifying with backend for user: ${this.currentUserId} (OS: ${Platform.OS})`);
            
            let endpointUrl = `${API_BASE_URL}/v1/auth/google-play/verify`;
            let requestBody = {};
            
            if (Platform.OS === 'ios') {
                // iOS Apple Pay flow
                endpointUrl = `${API_BASE_URL}/v1/auth/apple-iap/verify`;
                requestBody = {
                    user_id: this.currentUserId,
                    receipt_data: purchase.transactionReceipt, // iOS gives us transactionReceipt
                    product_id: purchase.productId,
                };
            } else {
                // Android Google Play flow (Untouched)
                endpointUrl = `${API_BASE_URL}/v1/auth/google-play/verify`;
                requestBody = {
                    user_id: this.currentUserId,
                    purchase_token: purchase.purchaseToken, // Android gives us purchaseToken
                    product_id: purchase.productId,
                };
            }

            const response = await fetch(endpointUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'apikey': process.env.EXPO_PUBLIC_SUPABASE_KEY,
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_KEY}`
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();
            console.log('[IAP] Backend verification result:', data.success);
            return data;
        } catch (err) {
            console.error('[IAP] Backend verification error', err);
            return { success: false, message: err.message };
        }
    }

    removeListeners() {
        if (this.purchaseUpdateSubscription) {
            this.purchaseUpdateSubscription.remove();
            this.purchaseUpdateSubscription = null;
        }
        if (this.purchaseErrorSubscription) {
            this.purchaseErrorSubscription.remove();
            this.purchaseErrorSubscription = null;
        }
    }

    async endConnection() {
        await endConnection();
    }
}

export default new SubscriptionService();