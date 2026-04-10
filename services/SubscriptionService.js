import { Platform } from 'react-native';
import {
    initConnection,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    purchaseUpdatedListener,
    purchaseErrorListener,
    getAvailablePurchases,
    getPendingTransactionsIOS,
    endConnection,
    getReceiptIOS
} from 'react-native-iap';
import Constants from '../Constants';

const API_BASE_URL = Constants.API_BASE_URL;

const itemSkus = Platform.select({
    ios: ['premium_monthly', 'premium_yearly'],
    android: ['premium_monthly', 'premium_yearly'],
});

class SubscriptionService {
    constructor() {
        this.purchaseUpdateSubscription = null;
        this.purchaseErrorSubscription = null;
        this.currentUserId = null;
        this.isConnected = false;
        this.isRequesting = false;
        this.onPurchaseSuccess = null;
        this.onPurchaseError = null;
    }

    setCurrentUserId(userId) {
        this.currentUserId = userId;
        console.log('[IAP] User ID set:', userId);
    }

    async initialize() {
        if (this.isConnected) {
            console.log('[IAP] Already connected. Skipping re-init.');
            return;
        }
        try {
            console.log('[IAP] Initializing connection...');
            await initConnection();
            this.isConnected = true;
            console.log('[IAP] Connection ready.');

            if (Platform.OS === 'ios') {
                try {
                    const pending = await getAvailablePurchases();
                    if (pending && pending.length > 0) {
                        console.log(`[IAP] Finishing ${pending.length} stuck transactions...`);
                        for (const purchase of pending) {
                            try {
                                await finishTransaction({ purchase, isConsumable: false });
                            } catch (e) {
                                console.warn('[IAP] Could not finish stuck transaction:', e);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[IAP] Pending transaction check failed:', e);
                }
            }
        } catch (err) {
            this.isConnected = false;
            console.warn('[IAP] Init error:', err.code, err.message);
        }
    }

    async getSubscriptions() {
        if (!this.isConnected) {
            console.warn('[IAP] Cannot fetch: not connected.');
            return [];
        }
        try {
            const products = await fetchProducts({ skus: itemSkus, type: 'subs' });
            console.log(`[IAP] Fetched ${products?.length || 0} subscription products.`);
            return products || [];
        } catch (err) {
            console.warn('[IAP] getSubscriptions error:', err);
            return [];
        }
    }

    async requestSubscription(sku, isTrial = false) {
        if (!this.isConnected) {
            throw new Error('Store connection is initializing. Please try again in a moment.');
        }
        if (this.isRequesting) {
            console.log('[IAP] Request already in progress. Blocked.');
            return;
        }

        try {
            this.isRequesting = true;

            if (Platform.OS === 'android') {
                await this._requestAndroid(sku, isTrial);
            } else {
                await this._requestIOS(sku);
            }

        } catch (err) {
            const code = err?.code || 'UNKNOWN';
            const msg = err?.message || 'Unknown error';
            console.warn(`[IAP] requestSubscription failed [${sku}]:`, { code, msg });

            if (code === 'E_USER_CANCELLED' || msg.includes('cancelled')) {
                throw new Error('Purchase cancelled');
            }
            if (code === 'E_USER_VERIFICATION_REQUIRED' || msg.includes('verification')) {
                throw new Error('Apple Account Verification required. Check your iOS Settings.');
            }
            throw new Error(`Store Error: ${msg}`);
        } finally {
            setTimeout(() => {
                this.isRequesting = false;
                console.log('[IAP] Bridge unlocked.');
            }, 2000);
        }
    }

    async _requestAndroid(sku, isTrial) {
        console.log(`[IAP][Android] Fetching product for SKU: ${sku}, trial: ${isTrial}`);
        const products = await fetchProducts({ skus: [sku], type: 'subs' });
        const product = products?.find(p => p.productId === sku || p.id === sku);

        if (!product) {
            throw new Error(`Product "${sku}" not found in Google Play.`);
        }

        const offers = product.subscriptionOfferDetailsAndroid || [];
        if (offers.length === 0) {
            throw new Error(`No offers found for "${sku}" in Google Play.`);
        }

        console.log(`[IAP][Android] Available offers for ${sku}:`, offers.map(o => o.offerId));

        let selectedOffer = null;

        if (isTrial) {
            selectedOffer = offers.find(offer => {
                const phases = offer.pricingPhases?.pricingPhaseList || [];
                const isFree = phases.some(phase => phase.priceAmountMicros === 0 || phase.priceAmountMicros === '0');
                const hasTrialId = (offer.offerId || '').toLowerCase().includes('trial');
                const hasTrialTag = (offer.offerTags || []).some(tag => tag.toLowerCase().includes('trial'));
                return isFree || hasTrialId || hasTrialTag;
            });
            if (selectedOffer) {
                console.log(`[IAP][Android] Trial offer selected: ${selectedOffer.offerId}`);
            } else {
                console.warn('[IAP][Android] No free trial offer found. Falling back to base plan.');
            }
        }

        if (!selectedOffer) {
            selectedOffer =
                offers.find(o => (o.offerId || '').toLowerCase().includes('base')) ||
                offers.find(offer => {
                    const phases = offer.pricingPhases?.pricingPhaseList || [];
                    return phases.every(
                        phase => phase.priceAmountMicros !== 0 && phase.priceAmountMicros !== '0'
                    );
                }) ||
                offers[0];
            console.log(`[IAP][Android] Base plan selected: ${selectedOffer?.offerId}`);
        }

        const offerToken = selectedOffer?.offerToken;
        if (!offerToken) {
            throw new Error(`Could not resolve offer token for "${sku}".`);
        }

        await requestPurchase({
            request: {
                android: {
                    skus: [sku],
                    subscriptionOffers: [{ sku, offerToken }],
                    obfuscatedAccountId: this.currentUserId,
                    obfuscatedProfileId: this.currentUserId,
                }
            },
            type: 'subs'
        });
    }

    async _requestIOS(sku) {
        console.log(`[IAP][iOS] Pre-flight check for SKU: ${sku}`);
        const fresh = await fetchProducts({ skus: [sku], type: 'subs' });
        const valid = fresh?.find(p => p.productId === sku || p.id === sku);

        if (!valid) {
            throw new Error('This plan is temporarily unavailable. Please try again in 30 seconds.');
        }

        console.log(`[IAP][iOS] SKU confirmed. Launching Apple payment sheet for: ${sku}`);

        // Extremely important: check for clogged pending transactions natively before adding a new one
        try {
            console.log('[IAP][iOS] Checking for pending transactions...');
            const pending = await getPendingTransactionsIOS();
            if (pending && pending.length > 0) {
                console.log(`[IAP][iOS] Found ${pending.length} stuck transactions. Clearing queue...`);
                for (const pt of pending) {
                    try {
                        await finishTransaction({ purchase: pt, isConsumable: false });
                        console.log(`[IAP][iOS] Cleared stuck transaction: ${pt.transactionId}`);
                    } catch (e) {
                         console.warn('[IAP][iOS] Failed to clear stuck transaction:', e);
                    }
                }
            }
        } catch (e) {
            console.warn('[IAP][iOS] Error checking pending transactions:', e);
        }

        // Disable auto-finish so we can manually finish after backend verification.
        await requestPurchase({
            skus: [sku], // Fallback for older JS bindings that might still check this
            sku: sku, // Extra fallback
            request: {
                apple: { // Using recommended key instead of deprecated 'ios'
                    sku,
                    appAccountToken: this.currentUserId, // Link to internal user ID (UUID)
                    andDangerouslyFinishTransactionAutomatically: false,
                }
            },
            type: 'subs'
        });

        console.log('[IAP][iOS] Payment sheet triggered successfully.');
    }

    async restorePurchases() {
        try {
            console.log('[IAP] Restoring purchases...');
            const purchases = await getAvailablePurchases();
            if (purchases && purchases.length > 0) {
                for (const purchase of purchases) {
                    await this.verifyPurchaseOnBackend(purchase);
                    // Apple requires us to ALWAYS finish the transaction when restoring
                    // Otherwise it stays clogged in the StoreKit queue permanently!
                    if (Platform.OS === 'ios') {
                        try {
                             console.log(`[IAP][iOS] Finishing restored transaction: ${purchase.transactionId}`);
                             await finishTransaction({ purchase, isConsumable: false });
                        } catch (e) { console.warn('Could not finish restored iOS transaction', e); }
                    }
                }
                return true;
            }
            return false;
        } catch (err) {
            console.warn('[IAP] Restore error:', err);
            throw err;
        }
    }

    setupPurchaseListeners(onSuccess = null, onError = null) {
        if (onSuccess) this.onPurchaseSuccess = onSuccess;
        if (onError) this.onPurchaseError = onError;

        // Always remove before re-registering to prevent duplicate listeners
        this.removeListeners();

        this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
            const receipt = purchase.transactionReceipt || purchase.purchaseToken;
            console.log('[IAP] Purchase update received.', { hasReceipt: !!receipt });

            if (receipt) {
                try {
                    const result = await this.verifyPurchaseOnBackend(purchase);
                    if (result.success) {
                        console.log('[IAP] Verified. Finishing transaction...');
                        await finishTransaction({ purchase, isConsumable: false });
                        if (this.onPurchaseSuccess) {
                            this.onPurchaseSuccess(purchase, result);
                        }
                    } else {
                        console.warn('[IAP] Backend verification failed:', result.message);
                        // If it's an iOS transaction and the backend specifically says 405 or 'No user',
                        // we must finish it anyway so we don't permanently brick their SKPaymentQueue.
                        if (Platform.OS === 'ios') {
                             console.log('[IAP][iOS] Forcing finish transaction to unclog Apple Queue...');
                             await finishTransaction({ purchase, isConsumable: false }).catch(() => {});
                        }
                    }
                } catch (err) {
                    console.error('[IAP] Transaction finish error:', err);
                }
            }
        });

        this.purchaseErrorSubscription = purchaseErrorListener((error) => {
            console.warn('[IAP] Purchase error event:', error);
            if (this.onPurchaseError) {
                this.onPurchaseError(error);
            }
        });
    }

    async verifyPurchaseOnBackend(purchase) {
        if (!this.currentUserId) {
            return { success: false, message: 'User not logged in' };
        }
        try {
            // Android uses purchaseToken (JWS/Token). iOS uses base64 Receipt string for legacy backend support.
            let iosReceipt = null;
            if (Platform.OS === 'ios') {
                try {
                    iosReceipt = await getReceiptIOS();
                } catch (e) {
                    console.warn('[IAP] Failed to get base64 receipt:', e);
                }
            }
            
            const token = purchase.transactionReceipt || purchase.purchaseToken;
            
            const requestBody = Platform.OS === 'ios'
                ? {
                    user_id: this.currentUserId,
                    receipt_data: iosReceipt || token,
                    product_id: purchase.productId,
                }
                : {
                    user_id: this.currentUserId,
                    purchase_token: token,
                    product_id: purchase.productId,
                };

            const endpoint = Platform.OS === 'ios'
                ? '/v1/auth/apple-iap/verify'
                : '/v1/auth/google-play/verify';

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.EXPO_PUBLIC_SUPABASE_KEY,
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_KEY}`,
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();
            console.log('[IAP] Backend verify result:', data.success);
            return data;
        } catch (err) {
            console.error('[IAP] Backend verify error:', err);
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
        this.isConnected = false;
        await endConnection();
    }
}

export default new SubscriptionService();