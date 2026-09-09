import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AppState } from 'react-native';
import { UserContext } from '../context/UserContext';
import Constants from '../Constants';

export const usePremiumPromo = (catalogLoaded = false) => {
    const {
        isPremium,
        telegramLinked,
        user,
        checkTelegramStatus,
        refreshUserStatus
    } = useContext(UserContext);

    const [promoCode, setPromoCode] = useState('');
    const [isPromoActive, setIsPromoActive] = useState(false);
    const [isWidgetVisible, setIsWidgetVisible] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [justActivated, setJustActivated] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    const timerRef = useRef(null);
    const pollIntervalRef = useRef(null);
    const wasPremiumRef = useRef(isPremium);

    // 1. FETCH ACTIVE PROMO CONFIG FROM BACKEND (Controlled by PROMO_CODE env var)
    const fetchActivePromo = useCallback(async () => {
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/promo/active`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.active && data.code) {
                    setPromoCode(data.code.trim().toUpperCase());
                    setIsPromoActive(true);
                    return;
                }
            }
            // If empty, missing, or active: false -> disable promo app-wide
            setPromoCode('');
            setIsPromoActive(false);
            setIsWidgetVisible(false);
            setIsSheetOpen(false);
        } catch (e) {
            console.log('[PROMO] Failed to fetch active promo config:', e);
            setPromoCode('');
            setIsPromoActive(false);
            setIsWidgetVisible(false);
        }
    }, []);

    // Initial fetch on mount
    useEffect(() => {
        fetchActivePromo();
    }, [fetchActivePromo]);

    // 2. TIMING RULE: Once catalog loads AND promo is active AND user is non-premium, wait 5s then show
    useEffect(() => {
        // Strict guard: if user is premium or promo is disabled, never show
        if (isPremium || !isPromoActive || !promoCode) {
            setIsWidgetVisible(false);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        if (catalogLoaded && !isWidgetVisible && !timerRef.current) {
            timerRef.current = setTimeout(() => {
                if (!isPremium && isPromoActive && promoCode) {
                    setIsWidgetVisible(true);
                }
                timerRef.current = null;
            }, 5000);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [catalogLoaded, isPremium, isPromoActive, promoCode, isWidgetVisible]);

    // 3. DETECT ACTIVATION: When premium flips to true while sheet is open
    useEffect(() => {
        if (!wasPremiumRef.current && isPremium) {
            if (isSheetOpen) {
                setJustActivated(true);
                const dismissTimer = setTimeout(() => {
                    setIsSheetOpen(false);
                    setIsWidgetVisible(false);
                    setJustActivated(false);
                }, 2200);
                return () => clearTimeout(dismissTimer);
            } else {
                setIsWidgetVisible(false);
            }
        }
        wasPremiumRef.current = isPremium;
    }, [isPremium, isSheetOpen]);

    // 4. APP FOREGROUND LISTENER: Re-check backend promo config & user status on resume
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                fetchActivePromo();
                if (checkTelegramStatus) checkTelegramStatus();
                if (refreshUserStatus) refreshUserStatus();
            }
        });

        return () => subscription.remove();
    }, [fetchActivePromo, checkTelegramStatus, refreshUserStatus]);

    // 5. ACTIVE POLLING: Poll status every 3 seconds while sheet is open
    useEffect(() => {
        if (isSheetOpen && !isPremium) {
            if (checkTelegramStatus) checkTelegramStatus();

            pollIntervalRef.current = setInterval(async () => {
                setIsChecking(true);
                try {
                    if (checkTelegramStatus) await checkTelegramStatus();
                    if (refreshUserStatus) await refreshUserStatus();
                } catch (e) {
                    console.log('[PROMO] Status poll error:', e);
                } finally {
                    setIsChecking(false);
                }
            }, 3000);
        } else {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        }

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [isSheetOpen, isPremium, checkTelegramStatus, refreshUserStatus]);

    const openSheet = () => {
        if (isPromoActive && promoCode && !isPremium) {
            setIsSheetOpen(true);
        }
    };

    const closeSheet = () => {
        if (!justActivated) {
            setIsSheetOpen(false);
        }
    };

    return {
        isPremium,
        telegramLinked,
        user,
        promoCode,
        isPromoActive,
        isWidgetVisible: isWidgetVisible && isPromoActive && !isPremium && Boolean(promoCode),
        isSheetOpen,
        justActivated,
        isChecking,
        openSheet,
        closeSheet,
        checkTelegramStatus,
        refreshUserStatus
    };
};
