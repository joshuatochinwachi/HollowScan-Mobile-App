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
    getReceiptIOS,
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
        this.isRequesting = false; // ← SINGLE-REQUEST GUARD
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

            // iOS FIX: Clear any "stuck" transactions on launch
            if (Platform.OS === 'ios') {
                try {
                    const purchases = await getAvailablePurchases();
                    if (purchases && purchases.length > 0) {
                        console.log(`[IAP] Found ${purchases.length} pending transactions on launch. Cleaning up...`);
                        for (const purchase of purchases) {
                            try {
                                await finishTransaction({ purchase, isConsumable: false });
                            } catch (fErr) {
                                console.warn('[IAP] Failed to finish pending transaction:', fErr);
                            }
                        }
                    }
                } catch (pErr) {
                    console.warn('[IAP] Error checking for pending transactions:', pErr);
                }
            }
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
            throw new Error('Store connection is initializing. Please try again in 5 seconds.');
        }

        if (this.isRequesting) {
            console.log('[IAP] Blocked concurrent request for:', sku);
            return; 
        }

        try {
            this.isRequesting = true;
            console.log('[IAP] Locking bridge for request:', sku);

            if (Platform.OS === 'android') {
                const products = await fetchProducts({ skus: [sku], type: 'subs' });
                const product = products?.find(p => p.id === sku);

                if (!product) {
                    throw new Error(`Product "${sku}" not found in Google Play.`);
                }

                const offerToken = product.subscriptionOfferDetailsAndroid?.[0]?.offerToken;
                if (!offerToken) {
                    throw new Error(`Offer token not found for ${sku}.`);
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
                // iOS (Modern v12+ request structure)
                console.log(`[IAP] Sending Apple request for sku: ${sku}`);
                await requestPurchase({
                    sku: sku,
                    andSubstitute: false 
                });
                console.log('[IAP] Native Apple request sent to bridge.');
            }
        } catch (err) {
            const errorCode = err?.code || 'UNKNOWN';
            const errorMsg = err?.message || 'No message';
            console.warn(`[IAP] Request Error [${sku}]:`, { code: errorCode, message: errorMsg });
            
            if (errorCode === 'E_USER_CANCELLED' || errorMsg.includes('cancelled')) {
                throw new Error('Purchase cancelled');
            }
            if (errorCode === 'E_USER_VERIFICATION_REQUIRED' || errorMsg.includes('verification')) {
                throw new Error('Apple Account Verification required. Check your iOS Settings.');
            }
            throw new Error(`Store Error: ${errorMsg}`);
        } finally {
            // Safety unlock after 2 seconds
            setTimeout(() => {
                this.isRequesting = false;
                console.log('[IAP] Unlocking bridge.');
            }, 2000);
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
                } else if (isVerified && isVerified.success === false) {
                    // --- SAFETY CLEANUP ---
                    // If the backend explicitly rejected the receipt (expired/invalid),
                    // we finish it to clear the stuck transaction queue and prevent bridge flooding.
                    console.log('[IAP] Safety cleanup: finishing rejected transaction:', purchase.productId);
                    try {
                        await finishTransaction({ purchase, isConsumable: false });
                    } catch (fErr) {
                        console.warn('[IAP] Safety cleanup failed:', fErr);
                    }
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
            // On Android, the token is `purchaseToken`.
            // On iOS (SK1 legacy path), it's `transactionReceipt`.
            // We check both so this listener fires correctly on both platforms.
            const token = purchase.purchaseToken || purchase.transactionReceipt;
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
            } else {
                // Defensive: on iOS SK2 JWS flow the token fields may be absent initially.
                // Still attempt verification with whatever is available.
                console.warn('[IAP] No token found on purchase object. Attempting verification anyway.');
                try {
                    const verificationResponse = await this.verifyWithBackend(purchase);
                    if (verificationResponse && verificationResponse.success) {
                        await finishTransaction({ purchase, isConsumable: false });
                        onSuccess && onSuccess(purchase, verificationResponse);
                    }
                } catch (fallbackErr) {
                    console.warn('[IAP] Fallback verification error:', fallbackErr);
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
            console.log(`[IAP][STEP 1] Verifying with backend for user: ${this.currentUserId} (OS: ${Platform.OS})`);
            
            let endpointUrl = `${API_BASE_URL}/v1/auth/google-play/verify`;
            let requestBody = {};
            
            if (Platform.OS === 'ios') {
                // iOS Apple Pay flow
                console.log(`[IAP][iOS] Checking for receipt on Product: ${purchase.productId}`);
                
                let receipt = purchase.transactionReceipt;
                
                if (!receipt || receipt.startsWith('eyJ')) {
                    console.log('[IAP][iOS] JWS detected or receipt missing, fetching legacy receipt...');
                    try {
                        receipt = await getReceiptIOS();
                    } catch (rErr) {
                        console.warn('[IAP][iOS] getReceiptIOS failed:', rErr);
                        receipt = null;
                    }
                }

                if (!receipt) {
                    console.error('[IAP][iOS] ERROR: No receipt data found!');
                    return { success: false, message: 'No receipt data available. Please try again.' };
                }
                
                if (receipt.startsWith('eyJ')) {
                    console.error('[IAP][iOS] ERROR: Receipt is still JWS after fallback!');
                    return { success: false, message: 'Receipt format incompatible.' };
                }

                endpointUrl = `${API_BASE_URL}/v1/auth/apple-iap/verify`;
                requestBody = {
                    user_id: this.currentUserId,
                    receipt_data: receipt,
                    product_id: purchase.productId,
                };
            } else {
                // Android Google Play flow
                console.log(`[IAP][ANDROID] Verifying Token on Product: ${purchase.productId}`);
                endpointUrl = `${API_BASE_URL}/v1/auth/google-play/verify`;
                requestBody = {
                    user_id: this.currentUserId,
                    purchase_token: purchase.purchaseToken,
                    product_id: purchase.productId,
                };
            }

            console.log(`[IAP][STEP 2] POSTing to: ${endpointUrl}`);
            const response = await fetch(endpointUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            console.log(`[IAP][STEP 3] Backend Response Status: ${response.status}`);
            const data = await response.json();
            console.log('[IAP][STEP 4] Backend verification result:', data.success ? 'SUCCESS' : 'FAILED');
            
            if (!data.success) {
                console.warn('[IAP][DEBUG] Backend error message:', data.message || data.detail || 'No detail');
            }
            
            return data;
        } catch (err) {
            console.error('[IAP][EXCEPTION] Backend verification fatal error:', err);
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