import { Platform } from 'react-native';
import {
    initConnection,
    getSubscriptions,
    requestSubscription,
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

    async getSubscriptions() {
        try {
            console.log('[IAP] Fetching subscriptions for SKUs:', itemSkus);
            const products = await getSubscriptions({ skus: itemSkus });
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
                // Fetch product to get the offerToken
                const products = await getSubscriptions({ skus: [sku] });
                const product = products?.find(p => p.productId === sku);

                if (!product) {
                    throw new Error(`Product ${sku} not found. Please ensure it's "Active" in Play Console.`);
                }

                // Get the first offer token (default base plan)
                const offerToken = product.subscriptionOfferDetails?.[0]?.offerToken;

                if (!offerToken) {
                    throw new Error(`Price/Offer not found for ${sku}. Check if the Base Plan is "Activated".`);
                }

                await requestSubscription({
                    sku: sku,
                    subscriptionOffers: [{ sku: sku, offerToken: offerToken }],
                });
            } else {
                // iOS
                await requestSubscription({
                    sku: sku,
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
            const receipt = purchase.transactionReceipt;
            if (receipt) {
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