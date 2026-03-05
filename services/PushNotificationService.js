import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from '../Constants';
import * as NavigationService from './NavigationService';

// Controls how notifications appear when the app IS in foreground
export const setupNotificationHandler = () => {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });

    // Fires when notification arrives and app is in foreground
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('[PUSH] Notification received in foreground:', notification);
    });

    // Fires when user TAPS a notification (foreground or background)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        handleNotificationTap(response.notification.request.content.data);
    });

    return () => {
        Notifications.removeNotificationSubscription(notificationListener);
        Notifications.removeNotificationSubscription(responseListener);
    };
};

// Call this in App.js useEffect on mount.
// Handles tap on a notification that opened the app from KILLED state.
export const handleKilledAppNotification = () => {
    const response = Notifications.getLastNotificationResponse();
    if (response) {
        console.log('[PUSH] App opened via notification tap from killed state');
        handleNotificationTap(response.notification.request.content.data);
    }
};

const handleNotificationTap = (data) => {
    if (!data) return;
    if (data.product_id) {
        console.log('[PUSH] Navigate to product:', data.product_id);
        NavigationService.navigate('ProductDetail', { productId: data.product_id });
    }
};

// Requests permission + registers Expo push token + saves to backend
export const registerForPushNotifications = async (userId) => {
    try {
        if (!Device.isDevice) {
            console.log('[PUSH] Not a real device — skipping registration');
            return null;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('[PUSH] Permission denied');
            return null;
        }

        // Android: ensure the 'default' channel exists
        // Must match channelId sent by backend in send_expo_push_notification()
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
            });
        }

        const token = (await Notifications.getExpoPushTokenAsync({
            projectId: '7589d6ec-f110-43fc-8e06-ff5572a88bc5'  // matches EAS projectId
        })).data;

        console.log('[PUSH] Expo Push Token:', token);
        if (userId) await savePushTokenToBackend(userId, token);
        return token;
    } catch (error) {
        console.log('[PUSH] Error registering:', error);
        return null;
    }
};

// Saves token to backend — calls POST /v1/user/push-token
export const savePushTokenToBackend = async (userId, token) => {
    try {
        const response = await fetch(
            `${Constants.API_BASE_URL}/v1/user/push-token?user_id=${userId}&token=${token}`,
            { method: 'POST' }
        );
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.log('[PUSH] Error saving token to backend:', error);
        return false;
    }
};

// Removes token on logout — calls DELETE /v1/user/push-token
export const unregisterPushToken = async (userId, token) => {
    try {
        const response = await fetch(
            `${Constants.API_BASE_URL}/v1/user/push-token?user_id=${userId}&token=${token}`,
            { method: 'DELETE' }
        );
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.log('[PUSH] Error unregistering token:', error);
        return false;
    }
};
