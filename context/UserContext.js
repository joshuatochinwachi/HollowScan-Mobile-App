import React, { createContext, useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from '../Constants';
import { registerForPushNotifications, setupNotificationHandler, unregisterPushToken } from '../services/PushNotificationService';
import SubscriptionService from '../services/SubscriptionService';



export const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const userRef = useRef(null);

    // --- CIRCUIT BREAKER ---
    // Prevent infinite network loops by throttling server checks
    const lastUserStatusCheckTime = useRef(0);
    const lastTelegramCheckTime = useRef(0);
    const CHECK_THROTTLE_MS = 30000; // 30 second cooldown

    // Keep userRef in sync with state
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const [isLoading, setIsLoading] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [telegramLinked, setTelegramLinked] = useState(false);
    const [isPremiumTelegram, setIsPremiumTelegram] = useState(false);
    const [premiumUntil, setPremiumUntil] = useState(null);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);
    const [countdown, setCountdown] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('USA Stores');
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [isFetchingPlans, setIsFetchingPlans] = useState(false);


    const [dailyViews, setDailyViews] = useState({
        date: new Date().toDateString(),
        products: [],
    });

    const FREE_PRODUCT_LIMIT = 4;

    // Load user data on mount
    useEffect(() => {
        const init = async () => {
            await loadUserData();
            await loadDailyViews();
            await loadTheme();
            await loadRegion();
            setupNotificationHandler();
            setIsLoading(false); // UI is now interactive

            // --- STAGGERED STARTUP (iOS Stability FIX) ---
            // We delay heavy native bridge initialization by 3 seconds.
            // This prevents the 'Login Sync Storm' where IAP, Push, and User Status
            // all fight for the native bridge at the exact same time.
            setTimeout(async () => {
                try {
                    console.log('[IAP] Staggered initialization starting...');
                    await SubscriptionService.initialize();
                    
                    // Startup Purchase Recovery
                    // Only run this IF the user is logged in
                    if (userRef.current?.id) {
                        console.log('[IAP] Running background recovery check...');
                        await SubscriptionService.restorePurchases();
                    }

                    await fetchIAPPlans();
                    SubscriptionService.setupPurchaseListeners(
                        async (purchase, verificationData) => {
                            console.log('[IAP] Purchase verified successfully');
                            const result = await refreshUserStatus(null, verificationData);
                            if (result && (result.is_premium || result.isPremium || result.success)) {
                                Alert.alert("You're Premium! 🚀", "Welcome to HollowScan Premium. Enjoy unlimited access!");
                            }
                        },
                        (error) => {
                            console.warn('[IAP] Purchase flow error:', error);
                        }
                    );
                } catch (staggerErr) {
                    console.warn('[IAP] Staggered init failed:', staggerErr);
                }
            }, 3000);
        };

        init();

        return () => {
            SubscriptionService.removeListeners();
        };
    }, []);

    const loadRegion = async () => {
        try {
            const stored = await AsyncStorage.getItem('selected_region');
            if (stored) {
                setSelectedRegion(stored);
            }
        } catch (error) {
            console.error('[REGION] Error loading region:', error);
        }
    };

    const updateRegion = async (newRegion) => {
        setSelectedRegion(newRegion);
        try {
            await AsyncStorage.setItem('selected_region', newRegion);
        } catch (error) {
            console.error('[REGION] Error saving region:', error);
        }
    };

    const fetchIAPPlans = async () => {
        if (isFetchingPlans) return;
        setIsFetchingPlans(true);
        try {
            console.log('[IAP] Fetching plans via UserContext...');
            const plans = await SubscriptionService.getSubscriptions();
            if (plans && plans.length > 0) {
                setSubscriptionPlans(plans);
                console.log('[IAP] Plans updated in Context:', plans.length);
            }
        } catch (error) {
            console.error('[IAP] Error fetching plans in context:', error);
        } finally {
            setIsFetchingPlans(false);
        }
    };

    const getPlanPrice = (sku) => {
        const FALLBACK_PRICES = {
            premium_monthly: '£4.99',
            premium_yearly: '£55.50',
        };
        const plan = subscriptionPlans.find(p => p.id === sku);
        if (plan) {
            console.log(`[IAP][DEBUG] Formatting price for ${sku} on ${Platform.OS}`);
            // Android: subscriptionOfferDetailsAndroid is the correct v14 field name
            if (plan.subscriptionOfferDetailsAndroid && plan.subscriptionOfferDetailsAndroid.length > 0) {
                const offer = plan.subscriptionOfferDetailsAndroid[0];
                if (offer.pricingPhases && offer.pricingPhases.pricingPhaseList && offer.pricingPhases.pricingPhaseList.length > 0) {
                    const price = offer.pricingPhases.pricingPhaseList[0].formattedPrice;
                    console.log(`[IAP][ANDROID] Extracted Price: ${price}`);
                    return price;
                }
            }
            // Fallback to iOS/legacy standard price
            const iosPrice = plan.localizedPrice || plan.price || FALLBACK_PRICES[sku] || '£4.99';
            console.log(`[IAP][iOS/FALLBACK] Price: ${iosPrice}`);
            return iosPrice;
        }
        return FALLBACK_PRICES[sku] || '£4.99';
    };

    const loadTheme = async () => {
        try {
            const stored = await AsyncStorage.getItem('is_dark_mode');
            if (stored !== null) {
                setIsDarkMode(JSON.parse(stored));
            }
        } catch (error) {
            console.error('[THEME] Error loading theme:', error);
        }
    };

    const loadUserData = async () => {
        try {
            const stored = await AsyncStorage.getItem('user_data');
            if (stored) {
                const userData = JSON.parse(stored);
                if (userData && userData.id) {
                    setUser(userData);
                    SubscriptionService.setCurrentUserId(userData.id); // ← FIX: set user ID on app load
                    registerForPushNotifications(userData.id);
                    checkTelegramStatus(userData.id, true); // Force initial check
                    setTimeout(() => refreshUserStatus(userData, null, true), 1000); // Force initial refresh
                } else {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('[USER] Error loading user data:', error);
            setUser(null);
        }
    };

    const login = async (email, password) => {
        const traceId = Math.random().toString(36).substring(7);
        try {
            console.log(`[AUTH][${traceId}] Login Start: ${email} on ${Platform.OS}`);
            const response = await fetch(`${Constants.API_BASE_URL}/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            console.log(`[AUTH][${traceId}] Server Response: ${response.status} ${response.statusText}`);
            const data = await response.json();
            
            if (data.success && data.user) {
                console.log(`[AUTH][${traceId}] Login Success for UID: ${data.user.id}`);
                await updateUser(data.user);
                return { success: true };
            } else {
                console.warn(`[AUTH][${traceId}] Login Failed: ${data.detail || 'Invalid credentials'}`);
                return { success: false, message: data.detail || 'Invalid credentials' };
            }
        } catch (error) {
            console.error(`[AUTH][${traceId}] Login Exception:`, error);
            return { success: false, message: 'Connection error. Please try again.' };
        }
    };

    const signup = async (email, password) => {
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            if (data.success && data.user) {
                setNeedsOnboarding(true);
                // Ensure a created_at date exists for trial calculation
                const userWithDate = {
                    ...data.user,
                    created_at: data.user.created_at || new Date().toISOString()
                };
                await updateUser(userWithDate);
                return { success: true };
            } else {
                return { success: false, message: data.detail || 'Signup failed' };
            }
        } catch (error) {
            console.error('[AUTH] Signup error:', error);
            return { success: false, message: 'Connection error. Please try again.' };
        }
    };

    const verifyCode = async (code) => {
        if (!user?.email || !code) return { success: false, message: 'Email and code required' };
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/auth/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, code }),
            });
            const data = await response.json();
            if (data.success) {
                await refreshUserStatus(null, null, true); // Force update after verification
            }
            return { success: data.success, message: data.message };
        } catch (error) {
            console.error('[AUTH] Verify error:', error);
            return { success: false, message: 'Connection error' };
        }
    };

    const forgotPassword = async (email) => {
        if (!email) return { success: false, message: 'Email required' };
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            return { success: data.success, message: data.message };
        } catch (error) {
            console.error('[AUTH] Forgot password error:', error);
            return { success: false, message: 'Connection error' };
        }
    };

    const resetPassword = async (email, code, password) => {
        if (!email || !code || !password) return { success: false, message: 'All fields required' };
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, password }),
            });
            const data = await response.json();
            return { success: data.success, message: data.message };
        } catch (error) {
            console.error('[AUTH] Reset password error:', error);
            return { success: false, message: 'Connection error' };
        }
    };

    const resendVerification = async () => {
        if (!user?.email) return { success: false, message: 'No email found' };
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/auth/resend-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email }),
            });
            const data = await response.json();
            return { success: data.success || response.ok, message: data.message || data.detail || 'Code sent!' };
        } catch (error) {
            console.error('[AUTH] Resend verification error:', error);
            return { success: false, message: 'Connection error' };
        }
    };

    const refreshUserStatus = async (passedUser = null, injectedData = null, force = false) => {
        const targetUser = passedUser || userRef.current;
        if (!targetUser?.id && !injectedData) return;

        // --- THROTTLE CHECK ---
        const now = Date.now();
        if (!force && !injectedData && (now - lastUserStatusCheckTime.current < CHECK_THROTTLE_MS)) {
            console.log('[USER] Status refresh throttled (checked recently)');
            return userRef.current;
        }

        try {
            const userIdBeforeFetch = targetUser?.id;
            let data = injectedData;
            
            if (!data) {
                lastUserStatusCheckTime.current = now; // Mark attempt
                const response = await fetch(`${Constants.API_BASE_URL}/v1/user/status?user_id=${targetUser.id}`);
                data = await response.json();
            } else {
                console.log('[USER] Using injected verification data for instant sync');
            }

            if (!userRef.current || (userIdBeforeFetch && userRef.current.id !== userIdBeforeFetch)) {
                console.log('[USER] Status refresh ignored: user changed or logged out during fetch');
                return;
            }

            const createdAt = data.created_at || data.joined || userRef.current?.created_at || userRef.current?.joined;
            const updatedUser = {
                ...userRef.current,
                name: data.name || userRef.current.name,
                bio: data.bio || userRef.current.bio,
                location: data.location || userRef.current.location,
                avatar_url: data.avatar_url || userRef.current.avatar_url,
                isPremium: data.is_premium !== undefined ? data.is_premium : (data.isPremium !== undefined ? data.isPremium : userRef.current?.isPremium),
                email_verified: data.email_verified !== undefined ? data.email_verified : (data.is_verified !== undefined ? data.is_verified : userRef.current?.email_verified),
                subscription_status: data.status !== undefined ? data.status : (data.subscription_status !== undefined ? data.subscription_status : userRef.current?.subscription_status),
                subscription_end: data.subscription_end !== undefined ? data.subscription_end : (data.subscriptionEnd !== undefined ? data.subscriptionEnd : userRef.current?.subscription_end),
                subscriptionEnd: data.subscription_end !== undefined ? data.subscription_end : (data.subscriptionEnd !== undefined ? data.subscriptionEnd : userRef.current?.subscriptionEnd), // FIX: Sync camelCase
                notification_preferences: data.notification_preferences || userRef.current?.notification_preferences,
                region: data.region || userRef.current?.region,
                created_at: createdAt ? new Date(createdAt).toISOString() : null
            };

            if (data.notification_preferences) {
                try {
                    const prefs = data.notification_preferences;
                    if (prefs.enabled !== undefined) {
                        await AsyncStorage.setItem('@hollowscan_notifications_enabled', JSON.stringify(prefs.enabled));
                    }
                    if (prefs.categories) {
                        const subs = {};
                        prefs.categories.forEach(cat => { if (cat !== 'ALL') subs[cat] = true; });
                        await AsyncStorage.setItem('@hollowscan_subscriptions', JSON.stringify(subs));
                    }
                    console.log('[USER] Sync\'d cloud alerts to local storage');
                } catch (syncError) {
                    console.error('[USER] Alert storage sync error:', syncError);
                }
            }

            setUser(updatedUser);
            await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
            return data;
        } catch (error) {
            console.error('[USER] Status refresh error:', error);
        }
    };

    const syncPreferences = async (preferences) => {
        if (!user?.id) return { success: false, message: 'User not logged in' };
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/user/notification-preferences?user_id=${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferences),
            });
            const data = await response.json();
            return { success: data.success };
        } catch (error) {
            console.error('[USER] Sync preferences error:', error);
            return { success: false };
        }
    };

    const logout = async () => {
        try {
            console.log('[AUTH] Logging out user:', userRef.current?.id);
            if (userRef.current?.id) {
                try {
                    const tokenData = await Notifications.getExpoPushTokenAsync({
                        projectId: '7589d6ec-f110-43fc-8e06-ff5572a88bc5'
                    });
                    if (tokenData && tokenData.data) {
                        await unregisterPushToken(userRef.current.id, tokenData.data);
                    }
                } catch (pushError) {
                    console.log('[AUTH] Error unregistering push token:', pushError);
                }
            }

            userRef.current = null;
            setUser(null);
            setTelegramLinked(false);
            setIsPremiumTelegram(false);
            setPremiumUntil(null);

            await AsyncStorage.removeItem('user_data');
            await AsyncStorage.removeItem('@hollowscan_notifications_enabled');
            await AsyncStorage.removeItem('@hollowscan_subscriptions');

            console.log('[AUTH] Logout complete');
        } catch (error) {
            console.error('[AUTH] Logout error:', error);
        }
    };

    const loadDailyViews = async () => {
        try {
            const stored = await AsyncStorage.getItem('daily_views');
            if (stored) {
                const data = JSON.parse(stored);
                if (data.date !== new Date().toDateString()) {
                    const newData = {
                        date: new Date().toDateString(),
                        products: [],
                    };
                    setDailyViews(newData);
                    await AsyncStorage.setItem('daily_views', JSON.stringify(newData));
                } else {
                    setDailyViews(data);
                }
            } else {
                const newData = {
                    date: new Date().toDateString(),
                    products: [],
                };
                setDailyViews(newData);
                await AsyncStorage.setItem('daily_views', JSON.stringify(newData));
            }
        } catch (error) {
            console.error('[USER] Error loading daily views:', error);
        }
    };

    const trackProductView = async (productId) => {
        if (!isPremium) {
            const remaining = getRemainingViews();
            if (remaining <= 0) {
                console.log('[LIMIT] Daily limit reached - showing modal');
                setShowLimitModal(true);
                refreshUserStatus();
                return { allowed: false, remaining: 0 };
            }
        } else {
            console.log('[LIMIT] Premium user - unlimited views');
        }

        try {
            const stored = await AsyncStorage.getItem('daily_views');
            let current = stored ? JSON.parse(stored) : { date: new Date().toDateString(), products: [] };

            if (current.date !== new Date().toDateString()) {
                current = { date: new Date().toDateString(), products: [] };
            }

            if (!current.products.includes(productId)) {
                current.products.push(productId);
                await AsyncStorage.setItem('daily_views', JSON.stringify(current));
                setDailyViews(current);

                /* 
                   DEPRECATED: Quota tracking is no longer used in Freemium blured model.
                   This call currently returns 405 Method Not Allowed on the server.
                */
                /*
                fetch(`${Constants.API_BASE_URL}/v1/user/views/track`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user?.id || 'guest', product_id: productId })
                }).catch(e => console.log('[LIMIT] Track view error (Safe to ignore):', e));
                */
            }

            refreshUserStatus();
            checkTelegramStatus().catch(() => { });

            return {
                allowed: true,
                remaining: isPremium ? Infinity : Math.max(0, FREE_PRODUCT_LIMIT - current.products.length)
            };
        } catch (error) {
            console.error('[VIEW] Error tracking view:', error);
            return { allowed: true };
        }
    };

    const getRemainingViews = () => {
        if (isPremium) return '∞';
        return Math.max(0, FREE_PRODUCT_LIMIT - dailyViews.products.length);
    };

    useEffect(() => {
        let interval;
        if (showLimitModal) {
            const updateCountdown = () => {
                const now = new Date();
                const midnight = new Date();
                midnight.setHours(24, 0, 0, 0);
                const diff = midnight - now;

                if (diff <= 0) {
                    setCountdown('00:00:00');
                    return;
                }

                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                setCountdown(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            };

            updateCountdown();
            interval = setInterval(updateCountdown, 1000);
        }
        return () => clearInterval(interval);
    }, [showLimitModal]);

    const linkTelegramAccount = async (code) => {
        if (!user?.id || !code) return { success: false, message: 'Invalid request' };
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/user/telegram/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, code }),
            });
            const data = await response.json();
            if (data.success) {
                checkTelegramStatus(user.id);
            }
            return { success: data.success, message: data.message };
        } catch (error) {
            console.error('[TELEGRAM] Link error:', error);
            return { success: false, message: 'Connection error' };
        }
    };

    const unlinkTelegramAccount = async () => {
        if (!user?.id) return { success: false, message: 'Not logged in' };
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/user/telegram/unlink`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id }),
            });
            const data = await response.json();
            if (data.success) {
                setTelegramLinked(false);
                setIsPremiumTelegram(false);
                setPremiumUntil(null);
                refreshUserStatus();
            }
            return data;
        } catch (error) {
            console.error('[TELEGRAM] Unlink error:', error);
            return { success: false, message: 'Connection error' };
        }
    };

    const checkTelegramStatus = async (specificUserId = null, force = false) => {
        const idToCheck = specificUserId || user?.id;
        if (!idToCheck) return;

        // --- THROTTLE CHECK ---
        const now = Date.now();
        if (!force && (now - lastTelegramCheckTime.current < CHECK_THROTTLE_MS)) {
            console.log('[TELEGRAM] Status check throttled');
            return { throttled: true };
        }
        lastTelegramCheckTime.current = now;

        console.log(`[DEBUG] checkTelegramStatus for ID: '${idToCheck}'`);

        try {
            const url = `${Constants.API_BASE_URL}/v1/user/telegram/link-status?user_id=${idToCheck}`;
            const response = await fetch(url);

            if (!response.ok) {
                const text = await response.text();
                console.error(`[TELEGRAM] Status check failed (${response.status}):`, text);
                return { linked: false, error: `Server error: ${response.status}` };
            }

            let data;
            try {
                data = await response.json();
            } catch (err) {
                const text = await response.text();
                console.error('[TELEGRAM] JSON Parse Error. Response:', text);
                return { linked: false, error: 'Invalid response from server' };
            }

            if (!userRef.current || userRef.current.id !== idToCheck) {
                console.log('[TELEGRAM] Status check ignored: user changed or logged out during fetch');
                return { linked: false };
            }

            if (data.success && data.linked) {
                setTelegramLinked(true);
                setIsPremiumTelegram(data.is_premium || false);
                setPremiumUntil(data.premium_until || null);
                // Removed recursive refreshUserStatus() to stop infinite loops
                return { linked: true, isPremium: data.is_premium };
            } else {
                setTelegramLinked(false);
                setIsPremiumTelegram(false);
                setPremiumUntil(null);
                // Removed recursive refreshUserStatus()
                return { linked: false };
            }
        } catch (error) {
            console.error('[TELEGRAM] Status check error:', error);
            setTelegramLinked(false);
            setIsPremiumTelegram(false);
            setPremiumUntil(null);
            // Removed recursive refreshUserStatus()
            return { linked: false, error: error.message };
        }
    };

    const updateUser = async (userData) => {
        try {
            if (!userData) return;

            setUser(userData);
            await AsyncStorage.setItem('user_data', JSON.stringify(userData));

            if (userData.id) {
                registerForPushNotifications(userData.id);
                checkTelegramStatus(userData.id);
                refreshUserStatus(userData);
                SubscriptionService.setCurrentUserId(userData.id);
            }
        } catch (error) {
            console.error('[USER] Error updating user:', error);
        }
    };

    const updateUserProfile = async (profileData) => {
        if (!user?.id) return { success: false, message: 'User not logged in' };
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/user/profile`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    ...profileData
                }),
            });
            const data = await response.json();

            if (data.success) {
                const updatedUser = { ...user, ...profileData };
                setUser(updatedUser);
                await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
            }

            return data;
        } catch (error) {
            console.error('[USER] Error updating profile:', error);
            return { success: false, message: 'Connection error' };
        }
    };

    const purchasePremium = async (planType = 'monthly', isTrial = false) => {
        if (!user?.id) return { success: false, message: 'Please login first' };
        const sku = planType === 'yearly' ? 'premium_yearly' : 'premium_monthly';
        try {
            SubscriptionService.setCurrentUserId(user.id);
            console.log(`[IAP] UserContext: Requesting ${isTrial ? 'TRIAL' : 'PURCHASE'} for ${sku}`);
            await SubscriptionService.requestSubscription(sku, isTrial);
            return { success: true }; 
        } catch (error) {
            console.error('[IAP] Purchase error in Context:', error);
            // react-native-iap on iOS sometimes throws an object natively { code: 'E_USER_CANCELLED', message: ... }
            const msg = error?.message || error?.code || (typeof error === 'string' ? error : 'Purchase failed or was cancelled.');
            return { success: false, message: msg };
        }
    };

    const resetDailyViews = async () => {
        const newData = {
            date: new Date().toDateString(),
            products: [],
        };
        setDailyViews(newData);
        await AsyncStorage.setItem('daily_views', JSON.stringify(newData));
    };

    const toggleTheme = async () => {
        try {
            const newValue = !isDarkMode;
            setIsDarkMode(newValue);
            await AsyncStorage.setItem('is_dark_mode', JSON.stringify(newValue));
        } catch (error) {
            console.error('[THEME] Error saving theme:', error);
        }
    };

    const isPremium = (() => {
        const now = new Date();

        // Check user object (both naming conventions)
        const expiryDate = user?.subscriptionEnd || user?.subscription_end;
        if (user?.isPremium && expiryDate) {
            const isTelegramSource = user?.subscriptionSource === 'telegram';
            if (isTelegramSource && !telegramLinked) {
                console.log('[STRICT] User marked premium via Telegram but not linked - ignoring.');
            } else {
                const expiry = new Date(expiryDate);
                if (expiry > now) return true;
            }
        }

        if (isPremiumTelegram && premiumUntil && telegramLinked) {
            const expiry = new Date(premiumUntil);
            if (expiry > now) return true;
        }

        return false;
    })();

    // Helper to check if the user is eligible for a 3-day free trial (Account < 72h old)
    const isTrialEligible = (() => {
        if (needsOnboarding) {
            console.log('[TRIAL][DEBUG] Eligible: needsOnboarding is true');
            return true;
        }
        
        if (!user) {
            console.log('[TRIAL][DEBUG] Not Eligible: No user object found');
            return false;
        }
        
        const createdDate = user.created_at || user.created || user.createdAt;
        if (!createdDate) {
            console.log('[TRIAL][DEBUG] Not Eligible: No creation date found for user');
            return false;
        }

        const created = new Date(createdDate);
        if (isNaN(created.getTime())) {
            console.log('[TRIAL][DEBUG] Not Eligible: Created date is invalid');
            return false;
        }

        const now = new Date();
        const diffInHours = Math.abs(now - created) / 36e5;
        
        const isEligible = diffInHours < 72;
        console.log(`[TRIAL][DEBUG] Account Age: ${diffInHours.toFixed(1)} hours. Eligible: ${isEligible}`);
        
        return isEligible;
    })();

    return (
        <UserContext.Provider
            value={{
                user,
                isLoading,
                isDarkMode,
                toggleTheme,
                dailyViews,
                trackProductView,
                getRemainingViews,
                updateUser,
                updateUserProfile,
                resetDailyViews,
                isPremium,
                login,
                signup,
                logout,
                resendVerification,
                refreshUserStatus,
                verifyCode,
                forgotPassword,
                resetPassword,
                linkTelegramAccount,
                unlinkTelegramAccount,
                checkTelegramStatus,
                telegramLinked,
                isPremiumTelegram,
                premiumUntil,
                showLimitModal,
                setShowLimitModal,
                needsOnboarding,
                setNeedsOnboarding,
                countdown,
                selectedRegion,
                updateRegion,
                syncPreferences,
                purchasePremium,
                subscriptionPlans,
                getPlanPrice,
                isTrialEligible
            }}
        >
            {children}
        </UserContext.Provider>
    );
};