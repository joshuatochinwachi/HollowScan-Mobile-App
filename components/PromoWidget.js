import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from '../Constants';

const PromoWidget = ({ isVisible, isPremium, onPress }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const brand = Constants.BRAND;

    useEffect(() => {
        if (isVisible && !isPremium) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }).start();

            // Subtle continuous pulse for attention
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();

            return () => pulse.stop();
        } else {
            Animated.timing(scaleAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible, isPremium]);

    // Visibility rule: strictly not mounted for premium users or before timer fires
    if (!isVisible || isPremium) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { scale: scaleAnim },
                        { scale: pulseAnim }
                    ],
                }
            ]}
            pointerEvents="box-none"
        >
            <TouchableOpacity
                activeOpacity={0.88}
                onPress={onPress}
                style={styles.touchable}
            >
                <LinearGradient
                    colors={['#6366F1', brand.BLUE, '#3730A3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                >
                    <View style={styles.iconWrapper}>
                        <Text style={styles.icon}>🎟️</Text>
                    </View>
                    <View style={styles.textWrapper}>
                        <Text style={styles.badgeLabel}>PROMO</Text>
                        <Text style={styles.titleText}>Free Premium</Text>
                    </View>
                    <View style={styles.sparkleDot} />
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 24,
        right: 16,
        zIndex: 999,
        elevation: 10,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
    },
    touchable: {
        borderRadius: 28,
        overflow: 'hidden',
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 28,
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    iconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    icon: {
        fontSize: 18,
    },
    textWrapper: {
        justifyContent: 'center',
    },
    badgeLabel: {
        color: '#FCD34D',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
    },
    titleText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    sparkleDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#34D399',
        marginLeft: 8,
    },
});

export default PromoWidget;
