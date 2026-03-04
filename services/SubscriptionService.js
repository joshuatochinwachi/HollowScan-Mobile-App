import { Platform } from 'react-native';
import * as RNIAP from 'react-native-iap';
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
    }

    async initialize() {
        try {
            await RNIAP.initConnection();
            if (Platform.OS === 'android') {
                await RNIAP.flushFailedPurchasesCachedAsPendingAndroid();
            }
            console.log('[IAP] Connection initialized');
        } catch (err) {
            console.warn('[IAP] Connection error', err.code, err.message);
        }
    }

    async getSubscriptions() {
        try {
            const products = await RNIAP.getSubscriptions({ skus: itemSkus });
            return products;
        } catch (err) {
            console.warn('[IAP] Error fetching subscriptions', err);
            return [];
        }
    }

    async requestSubscription(sku) {
        try {
            await RNIAP.requestSubscription({ sku });
        } catch (err) {
            console.warn('[IAP] Error requesting subscription', err.code, err.message);
            throw err;
        }
    }

    setupPurchaseListeners(onSuccess, onError) {
        this.purchaseUpdateSubscription = RNIAP.purchaseUpdatedListener(async (purchase) => {
            const receipt = purchase.transactionReceipt;
            if (receipt) {
                try {
                    // Verify with Backend
                    const isVerified = await this.verifyWithBackend(purchase);
                    if (isVerified) {
                        await RNIAP.finishTransaction({ purchase, isConsumable: false });
                        onSuccess && onSuccess(purchase);
                    } else {
                        onError && onError('Verification failed');
                    }
                } catch (ackErr) {
                    console.warn('[IAP] Ack Error', ackErr);
                    onError && onError(ackErr.message);
                }
            }
        });

        this.purchaseErrorSubscription = RNIAP.purchaseErrorListener((error) => {
            console.warn('[IAP] Purchase Error', error);
            onError && onError(error.message);
        });
    }

    async verifyWithBackend(purchase) {
        try {
            // Assuming purchase.transactionReceipt contains the token on Android
            const response = await fetch(`${API_BASE_URL}/v1/auth/google-play/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: this.currentUserId, // This needs to be passed correctly from context
                    purchase_token: purchase.purchaseToken,
                    product_id: purchase.productId,
                }),
            });

            const data = await response.json();
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
        await RNIAP.endConnection();
    }
}

export default new SubscriptionService();
