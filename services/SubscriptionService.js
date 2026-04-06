import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    initConnection,
    fetchProducts,
    requestSubscription,
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
        this.isRequesting = false; // ← SINGLE-REQUEST GUARD ADDED TODAY
    }

    setCurrentUserId(userId) {
        this.currentUserId = userId;
        console.log('[IAP] User ID set for backend verification:', userId);
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
                console.warn('[IAP] No products returned from Store. Possible causes: SKUs mismatch or Regional restriction.');
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
        
        // ADDED TODAY: Prevent double-tap bridge crash
        if (this.isRequesting) {
            console.log('[IAP] Blocked concurrent bridge request for:', sku);
            return;
        }

        try {
            this.isRequesting = true;
            console.log('[IAP] Native bridge request for SKU:', sku);

            if (Platform.OS === 'android') {
                const products = await fetchProducts({ skus: [sku], type: 'subs' });
                const product = products?.find(p => p.productId === sku || p.id === sku);

                if (!product) {
                    throw new Error(`Product "${sku}" not found in Google Play.`);
                }

                const offerToken = product.subscriptionOfferDetailsAndroid?.[0]?.offerToken;
                if (!offerToken) {
                    throw new Error(`Offer token not found for ${sku}.`);
                }

                await requestSubscription({
                    skus: [sku],
                    subscriptionOffers: [{ sku, offerToken }],
                    obfuscatedAccountIdAndroid: this.currentUserId,
                    obfuscatedProfileIdAndroid: this.currentUserId,
                });
            } else {
                // iOS (Pre-flight sync to prevent 'Missing Configuration' error)
                console.log(`[IAP] Pre-flight sync for SKU: ${sku}`);
                
                // Force a re-fetch to 'warm up' the native bridge for this specific SKU
                const fresh = await fetchProducts({ skus: [sku], type: 'subs' });
                const valid = fresh?.find(p => p.productId === sku || p.id === sku);
                
                if (!valid) {
                    console.warn(`[IAP] SKU ${sku} was not found by Apple Store during pre-flight.`);
                    throw new Error('This plan is temporarily unavailable. Please try again in 30 seconds.');
                }

                console.log(`[IAP] Bridge confirmed. Launching Apple sheet for: ${sku}`);
                
                // v14: Use requestSubscription for all subscription products
                await requestSubscription({
                    sku: sku
                });
                console.log('[IAP] Native Apple requestSubscription successfully triggered.');
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
            if (purchases && purchases.length > 0) {
                console.log(`[IAP] Found ${purchases.length} purchases to verify.`);
                for (const purchase of purchases) {
                    await this.verifyPurchaseOnBackend(purchase);
                }
                return true;
            }
            return false;
        } catch (err) {
            console.warn('[IAP] Restore error:', err);
            throw err;
        }
    }

    setupPurchaseListeners() {
        this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
            const receipt = purchase.transactionReceipt;
            console.log('[IAP] Purchase update received.');
            
            if (receipt) {
                try {
                    const result = await this.verifyPurchaseOnBackend(purchase);
                    
                    if (result.success) {
                        console.log('[IAP] Backend verification successful. Finishing transaction...');
                        await finishTransaction({ purchase, isConsumable: false });
                    } else {
                        console.warn('[IAP] Backend verification failed:', result.message);
                    }
                } catch (err) {
                    console.error('[IAP] Failed to finish transaction:', err);
                }
            }
        });

        this.purchaseErrorSubscription = purchaseErrorListener((error) => {
            console.warn('[IAP] Purchase error listener event:', error);
        });
    }

    async verifyPurchaseOnBackend(purchase) {
        if (!this.currentUserId) {
            console.warn('[IAP] Cannot verify: Missing currentUserId.');
            return { success: false, message: 'User not logged in' };
        }

        try {
            const endpointUrl = `${API_BASE_URL}/v1/subscriptions/verify`;
            let requestBody;

            if (Platform.OS === 'ios') {
                requestBody = {
                    user_id: this.currentUserId,
                    receipt_data: purchase.transactionReceipt,
                    product_id: purchase.productId,
                };
            } else {
                requestBody = {
                    user_id: this.currentUserId,
                    purchase_token: purchase.purchaseToken,
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
            console.log('[IAP] Backend verification result success:', data.success);
            return data;
        } catch (err) {
            console.error('[IAP] Backend verification fatal error', err);
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