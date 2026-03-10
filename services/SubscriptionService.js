import { Platform } from 'react-native';
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

// Subscription product IDs defined in Google Play Console
const itemSkus = Platform.select({
    ios: [], // Add iOS SKUs if needed later
    android: ['premium_monthly', 'premium_yearly'],
});

class SubscriptionService {
    constructor() {
        this.purchaseUpdateSubscription = null;
        this.purchaseErrorSubscription = null;
        this.currentUserId = null;
    }

    setCurrentUserId(userId) {
        this.currentUserId = userId;
        console.log('[IAP] User ID set for verification:', userId);
    }

    async initialize() {
        try {
            const result = await initConnection();
            console.log('[IAP] Connection initialized:', result);
        } catch (err) {
            console.warn('[IAP] Connection error', err.code, err.message);
        }
    }

    // Fetches subscription plan details (prices, offer tokens, etc.)
    async getSubscriptions() {
        try {
            console.log('[IAP] Fetching subscriptions for SKUs:', itemSkus);
            const products = await fetchProducts({ skus: itemSkus, type: 'subs' });
            console.log('[IAP] Products found:', products?.length || 0);
            return products || [];
        } catch (err) {
            console.warn('[IAP] Error fetching subscriptions', err);
            return [];
        }
    }

    async requestSubscription(sku) {
        try {
            console.log('[IAP] Requesting subscription for:', sku);

            if (Platform.OS === 'android') {
                // Fetch the specific product to get its offerToken
                const products = await fetchProducts({ skus: [sku], type: 'subs' });
                const product = products?.find(p => p.productId === sku);

                if (!product) {
                    throw new Error(`Product ${sku} not found. Please ensure it's "Active" in Play Console.`);
                }

                // offerToken is required for Android subscriptions in v14
                const offerToken = product.subscriptionOfferDetailsAndroid?.[0]?.offerToken;

                if (!offerToken) {
                    throw new Error(`Offer token not found for ${sku}. Check the Base Plan is "Activated".`);
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
                if (isVerified) {
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
                    const isVerified = await this.verifyWithBackend(purchase);
                    if (isVerified) {
                        await finishTransaction({ purchase, isConsumable: false });
                        console.log('[IAP] Transaction finished successfully');
                        onSuccess && onSuccess(purchase);
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
        if (!this.currentUserId) {
            console.error('[IAP] Cannot verify: currentUserId is null');
            return false;
        }

        try {
            console.log('[IAP] Verifying with backend for user:', this.currentUserId);
            const response = await fetch(`${API_BASE_URL}/v1/auth/google-play/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.currentUserId,
                    purchase_token: purchase.purchaseToken,
                    product_id: purchase.productId,
                }),
            });

            const data = await response.json();
            console.log('[IAP] Backend verification result:', data.success);
            return data.success;
        } catch (err) {
            console.error('[IAP] Backend verification error', err);
            return false;
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