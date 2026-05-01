import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Animated,
    Dimensions,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { UserContext } from '../context/UserContext';
import Constants from '../Constants';

const { width } = Dimensions.get('window');

const PCMonitorHub = () => {
    const navigation = useNavigation();
    const { user, isPremium, isDarkMode } = useContext(UserContext);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const pulseAnim = useRef(new Animated.Value(0.4)).current;

    // Pulse animation for "Live" status
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.4,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const fetchStatus = useCallback(async () => {
        if (!user?.id) return;
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/monitor/pokemon-center/status?user_id=${user.id}`);
            const data = await response.json();
            if (data.success) {
                setStatus(data);
            }
        } catch (error) {
            console.error('[MONITOR] Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [fetchStatus, isPremium]);

    const handleEnableAlerts = async () => {
        if (!user?.id || submitting) return;
        setSubmitting(true);
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/monitor/pokemon-center/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    fcm_token: 'TOPIC_SUBSCRIBER'
                }),
            });
            const data = await response.json();
            if (data.success) {
                await fetchStatus();
            }
        } catch (error) {
            console.error('[MONITOR] Subscribe error:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDisableAlerts = async () => {
        if (!user?.id || submitting) return;
        setSubmitting(true);
        try {
            const response = await fetch(`${Constants.API_BASE_URL}/v1/monitor/pokemon-center/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id }),
            });
            const data = await response.json();
            if (data.success) {
                await fetchStatus();
            }
        } catch (error) {
            console.error('[MONITOR] Unsubscribe error:', error);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && !status) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color={Constants.BRAND.BLUE} />
            </View>
        );
    }

    // STATE: FREE USER (LOCKED)
    if (status?.state === 'LOCKED' || !isPremium) {
        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate('PremiumPaywall')}
                style={styles.container}
            >
                <BlurView intensity={isDarkMode ? 40 : 60} style={styles.blur}>
                    <LinearGradient
                        colors={['rgba(79, 70, 229, 0.05)', 'rgba(0,0,0,0)']}
                        style={styles.gradient}
                    />
                    <View style={styles.content}>
                        <View style={styles.leftSection}>
                            <View style={[styles.pulseCircle, { backgroundColor: '#8E8E93', opacity: 0.5 }]} />
                            <View>
                                <Text style={[styles.title, { color: isDarkMode ? '#FFF' : '#000' }]}>Pokémon Center Monitor</Text>
                                <Text style={styles.subtitle}>Unlock to monitor and get notified when the queue goes live! 🔔</Text>
                            </View>
                        </View>
                        <View style={styles.lockBadge}>
                            <Text style={styles.lockIcon}>🔒</Text>
                        </View>
                    </View>
                </BlurView>
            </TouchableOpacity>
        );
    }

    const isQueueActive = status?.state === 'QUEUE_ACTIVE';
    const isSubscribed = status?.is_subscribed;

    // STATE: PREMIUM (QUEUE ACTIVE)
    if (isQueueActive) {
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => Linking.openURL('https://www.pokemoncenter.com')}
                style={[styles.container, styles.activeContainer]}
            >
                <LinearGradient
                    colors={['#FF4B2B', '#FF416C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradient}
                >
                    <View style={styles.content}>
                        <View style={styles.leftSection}>
                            <Animated.View style={[styles.pulseCircle, { backgroundColor: '#FFF', opacity: pulseAnim }]} />
                            <View>
                                <Text style={[styles.title, { color: '#FFF' }]}>🚨 POKEMON CENTER: QUEUE LIVE</Text>
                                <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }]}>
                                    Join now to secure your spot!
                                </Text>
                            </View>
                        </View>
                        <View style={styles.actionButtonWhite}>
                            <Text style={styles.actionButtonTextRed}>JOIN</Text>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    // STATE: PREMIUM (SITE NORMAL)
    return (
        <View style={styles.container}>
            <BlurView intensity={isDarkMode ? 30 : 50} style={styles.blur}>
                <View style={styles.content}>
                    <View style={styles.leftSection}>
                        <Animated.View style={[styles.pulseCircle, { backgroundColor: '#4ADE80', opacity: pulseAnim }]} />
                        <View>
                            <Text style={[styles.title, { color: isDarkMode ? '#FFF' : '#000' }]}>Pokémon Center Status</Text>
                            <Text style={styles.subtitle}>
                                {!isSubscribed ? "Get notified instantly when the queue goes live! 🔔" : "You'll be notified as soon as the queue goes live! 🔔"}
                            </Text>
                        </View>
                    </View>

                    {!isSubscribed ? (
                        <TouchableOpacity
                            onPress={handleEnableAlerts}
                            disabled={submitting}
                            style={styles.actionButtonBlue}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.actionButtonText}>Enable Alerts</Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={handleDisableAlerts}
                            disabled={submitting}
                            style={styles.activeBadge}
                        >
                            <Text style={styles.activeBadgeText}>
                                {submitting ? "..." : "Alerts On"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </BlurView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width - 32,
        alignSelf: 'center',
        height: 70,
        borderRadius: 16,
        overflow: 'hidden',
        marginVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    activeContainer: {
        borderColor: '#FF416C',
        shadowColor: '#FF416C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    blur: {
        flex: 1,
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pulseCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 11,
        color: '#8E8E93',
        marginTop: 1,
    },
    lockBadge: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 8,
        borderRadius: 10,
    },
    lockIcon: {
        fontSize: 16,
    },
    actionButtonBlue: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        minWidth: 100,
        alignItems: 'center',
    },
    actionButtonWhite: {
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
    },
    actionButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    actionButtonTextRed: {
        color: '#FF416C',
        fontSize: 12,
        fontWeight: '800',
    },
    activeBadge: {
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
    },
    activeBadgeText: {
        color: '#4ADE80',
        fontSize: 11,
        fontWeight: '700',
    },
    loaderContainer: {
        height: 70,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default PCMonitorHub;
