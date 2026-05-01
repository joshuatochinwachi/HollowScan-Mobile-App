import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import ExpoConstants from 'expo-constants';
import AppConstants from '../Constants';
import * as NavigationService from './NavigationService';

// ─── CRITICAL: This MUST be at the top level of the file, outside all functions ───
// This controls how notifications appear when the app is in the FOREGROUND.
// Without this, foreground notifications are silently swallowed.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Sets up listeners for:
 * 1. Notifications received while app is in foreground
 * 2. User tapping a notification (foreground or background)
 *
 * Call this once in App.js useEffect on mount.
 * Returns a cleanup function — call it on unmount.
 */
export const setupNotificationHandler = () => {
    // Fires when a notification arrives and the app is open (foreground)
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('[PUSH] Notification received in foreground:', notification);
    });

    // Fires when the user taps a notification (foreground or background states)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('[PUSH] User tapped notification');
        handleNotificationTap(response.notification.request.content.data);
    });

    return () => {
        Notifications.removeNotificationSubscription(notificationListener);
        Notifications.removeNotificationSubscription(responseListener);
    };
};

/**
 * Handles the case where the app was KILLED (not running) and the user
 * tapped a notification to open it.
 *
 * In this state, addNotificationResponseReceivedListener does NOT fire
 * because the app wasn't running. Instead, we must call this manually
 * at app startup to check if the app was opened via a notification tap.
 *
 * Call this in App.js useEffect on mount, after setupNotificationHandler().
 */
export const handleKilledAppNotification = () => {
    const response = Notifications.getLastNotificationResponse();
    if (response) {
        console.log('[PUSH] App was opened from killed state via notification tap');
        handleNotificationTap(response.notification.request.content.data);
    }
};

/**
 * Internal handler — called when user taps any notification.
 * Add your navigation logic here.
 */
const handleNotificationTap = (data) => {
    if (!data) return;
    console.log('[PUSH] Notification data:', data);

    if (data.product_id) {
        console.log('[PUSH] Navigating to product:', data.product_id);
        NavigationService.navigate('ProductDetail', { productId: data.product_id });
    } else if (data.type === 'pc_monitor') {
        console.log('[PUSH] Pokémon Center alert detected, navigating Home');
        NavigationService.navigate('Home');
    }
};

/**
 * Requests push notification permission from the user,
 * registers the device with Expo Push Service,
 * and saves the Expo Push Token to the backend.
 *
 * Call this after the user logs in and you have a userId.
 */
export const registerForPushNotifications = async (userId) => {
    try {
        if (!Device.isDevice) {
            console.log('[PUSH] Skipping — not a real physical device');
            return null;
        }

        // Request permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('[PUSH] Permission denied by user');
            return null;
        }

        // Android: register the notification channel
        // The channel name 'default' must match the channelId sent by the backend
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#E94560',
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
            });
        }

        // Get the projectId from app config (most reliable method)
        const projectId =
            ExpoConstants?.expoConfig?.extra?.eas?.projectId ??
            ExpoConstants?.easConfig?.projectId;

        if (!projectId) {
            console.log('[PUSH] ERROR: projectId not found in app config');
            return null;
        }

        // Get the Expo Push Token for this device
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('[PUSH] Expo Push Token obtained:', token);

        // Save the token to the backend so the server can send notifications
        if (userId) {
            await savePushTokenToBackend(userId, token);
        }

        return token;
    } catch (error) {
        console.log('[PUSH] Error registering for push notifications:', error);
        return null;
    }
};

/**
 * Saves the Expo Push Token to the backend.
 * Calls POST /v1/user/push-token
 */
export const savePushTokenToBackend = async (userId, token) => {
    try {
        const API_BASE_URL = AppConstants.API_BASE_URL;
        const response = await fetch(
            `${API_BASE_URL}/v1/user/push-token?user_id=${userId}&token=${encodeURIComponent(token)}`,
            { method: 'POST' }
        );
        const data = await response.json();
        console.log('[PUSH] Token saved to backend:', data.success);
        return data.success;
    } catch (error) {
        console.log('[PUSH] Error saving token to backend:', error);
        return false;
    }
};

/**
 * Removes the push token from the backend on logout.
 * Calls DELETE /v1/user/push-token
 */
export const unregisterPushToken = async (userId, token) => {
    try {
        const API_BASE_URL = AppConstants.API_BASE_URL;
        const response = await fetch(
            `${API_BASE_URL}/v1/user/push-token?user_id=${userId}&token=${encodeURIComponent(token)}`,
            { method: 'DELETE' }
        );
        const data = await response.json();
        console.log('[PUSH] Token removed from backend:', data.success);
        return data.success;
    } catch (error) {
        console.log('[PUSH] Error removing token from backend:', error);
        return false;
    }
};
