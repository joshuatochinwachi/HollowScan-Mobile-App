import React, { useContext, useState } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';

import { BlurView } from 'expo-blur';
import { UserContext } from '../context/UserContext';
import Constants from '../Constants';
import { useNavigation } from '@react-navigation/native';

const DailyLimitModal = () => {
    const {
        showLimitModal,
        setShowLimitModal,
        countdown,
        isDarkMode,
        telegramLinked,
        checkTelegramStatus,
        user,
        purchasePremium,
        isPremium,
        getPlanPrice
    } = useContext(UserContext);
    const navigation = useNavigation();
    const brand = Constants.BRAND;

    // Local state for the Telegram flow within the modal
    const [showTelegramFlow, setShowTelegramFlow] = useState(false);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);

    const colors = isDarkMode ? {
        card: '#161618',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: 'rgba(255,255,255,0.08)',
    } : {
        card: '#FFFFFF',
        text: '#1C1C1E',
        textSecondary: '#636366',
        border: 'rgba(0,0,0,0.05)',
    };

    const handleCheckLinkStatus = async () => {
        setIsCheckingStatus(true);
        try {
            const result = await checkTelegramStatus();
            if (result && result.linked) {
                setShowTelegramFlow(false);
                setShowTelegramFlow(false);
                setShowLimitModal(false);
                Alert.alert('🎉 Success', 'Telegram account linked and premium status synced!');
            } else {
                Alert.alert('⏳ Not Linked Yet', 'Send the command to the bot first, then try again.');
            }

        } catch (error) {
            console.error('[TELEGRAM] Error:', error);
        } finally {
            setIsCheckingStatus(false);
        }
    };


    if (!showLimitModal) return null;

    return (
        <Modal visible={showLimitModal} animationType="fade" transparent={true}>
            <BlurView intensity={90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
                <View style={styles.modalCenter}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card, maxWidth: 360 }]}>
                        {/* Icon */}
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: brand.BLUE + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 40 }}>{showTelegramFlow ? '📱' : '⏰'}</Text>
                            </View>
                            <Text style={[styles.modalTitle, { color: colors.text, fontSize: 22, textAlign: 'center' }]}>
                                {showTelegramFlow ? 'Connect Telegram' : 'Daily Limit Reached'}
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
                                {showTelegramFlow
                                    ? 'Link your Telegram to sync premium status and get instant deal alerts!'
                                    : "You've viewed your 4 free products for today. Come back tomorrow or upgrade to Premium!"}
                            </Text>
                        </View>

                        {!showTelegramFlow ? (
                            <View>
                                {/* Countdown Timer */}
                                <View style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F3F4F6', padding: 20, borderRadius: 16, marginBottom: 20 }}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 8, fontWeight: '600' }}>
                                        RESETS IN
                                    </Text>
                                    <Text style={{ color: colors.text, fontSize: 36, textAlign: 'center', fontWeight: '800', letterSpacing: 2 }}>
                                        {countdown}
                                    </Text>
                                </View>

                                {/* Premium Benefits (Mandatory for App Store) */}
                                <View style={{ marginBottom: 20, paddingHorizontal: 5 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={{ fontSize: 14, marginRight: 8 }}>🚀</Text>
                                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Unlimited daily deal views</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={{ fontSize: 14, marginRight: 8 }}>🌍</Text>
                                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>All regions (US, UK, CA)</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14, marginRight: 8 }}>⚡</Text>
                                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Instant High-Profit alerts</Text>
                                    </View>
                                </View>

                                {/* Google/Apple Pay CTA */}
                                <TouchableOpacity
                                    style={{ backgroundColor: isDarkMode ? '#FFF' : '#111', padding: 16, borderRadius: 12, marginBottom: 10, elevation: 4 }}
                                    onPress={async () => {
                                        const result = await purchasePremium('monthly');
                                        if (result.success) {
                                            setShowLimitModal(false);
                                        } else {
                                            if (result.message !== 'Purchase cancelled') {
                                                Alert.alert('Error', result.message || 'Purchase failed');
                                            }
                                        }
                                    }}
                                >
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={{ color: isDarkMode ? '#000' : '#FFF', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
                                            Monthly Premium • 1 Month
                                        </Text>
                                        <Text style={{ color: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' }}>
                                            {getPlanPrice('premium_monthly')} / month
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{ backgroundColor: '#FFD700', padding: 16, borderRadius: 12, marginBottom: 15, elevation: 4 }}
                                    onPress={async () => {
                                        const result = await purchasePremium('yearly');
                                        if (result.success) {
                                            setShowLimitModal(false);
                                        } else {
                                            if (result.message !== 'Purchase cancelled') {
                                                Alert.alert('Error', result.message || 'Purchase failed');
                                            }
                                        }
                                    }}
                                >
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={{ color: '#000', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
                                            Yearly Premium • 1 Year 👑
                                        </Text>
                                        <Text style={{ color: 'rgba(0,0,0,0.5)', fontSize: 12, fontWeight: '700' }}>
                                            {getPlanPrice('premium_yearly')} / year
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {/* LEGAL LINKS (Required for Auto-Renewable Subscriptions) */}
                                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 5 }}>
                                    <TouchableOpacity 
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        onPress={() => { setShowLimitModal(false); navigation.navigate('Profile'); }}
                                    >
                                        <Text style={{ color: brand.BLUE, fontSize: 11, textDecorationLine: 'underline' }}>Terms of Use (EULA)</Text>
                                    </TouchableOpacity>
                                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>•</Text>
                                    <TouchableOpacity 
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        onPress={() => Linking.openURL('https://www.hollowscan.com/privacy-policy')}
                                    >
                                        <Text style={{ color: brand.BLUE, fontSize: 11, textDecorationLine: 'underline' }}>Privacy Policy</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Telegram CTA */}


                                {/* Close Button */}
                                <TouchableOpacity
                                    style={{ padding: 12 }}
                                    onPress={() => setShowLimitModal(false)}
                                >
                                    <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
                                        Close
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ marginBottom: 20 }}>
                                <View style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F9FAFB', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}>
                                    <Text style={{ fontSize: 40, marginBottom: 16 }}>🤖</Text>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 }}>Ready to Connect?</Text>
                                    <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 }}>We'll open Telegram for you. Just tap "Connect" in the bot to link your account!</Text>
                                </View>

                                <TouchableOpacity
                                    style={{ backgroundColor: '#0EA5E9', padding: 16, borderRadius: 12, marginBottom: 12 }}
                                    onPress={() => {
                                        // New Direct Link: App -> Telegram with user ID
                                        const telegramUrl = `https://t.me/hollowscan_bot?start=link_${user.id}`;
                                        Linking.openURL(telegramUrl).catch(() => {
                                            Alert.alert('Error', 'Could not open Telegram. Please install Telegram first.');
                                        });

                                        // Auto-check status after delay
                                        setTimeout(async () => {
                                            const result = await checkTelegramStatus();
                                            if (result && result.linked) {
                                                setShowTelegramFlow(false);
                                                setShowLimitModal(false);
                                                Alert.alert('🎉 Success!', 'Telegram account linked and premium status synced!');
                                            }
                                        }, 5000);
                                    }}
                                >
                                    <Text style={{ color: '#FFF', fontWeight: '800', textAlign: 'center', fontSize: 16 }}>🚀 Open Telegram Bot</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{ backgroundColor: '#10B981', padding: 16, borderRadius: 12 }}
                                    onPress={handleCheckLinkStatus}
                                    disabled={isCheckingStatus}
                                >
                                    {isCheckingStatus ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Already Linked? Verify</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{ padding: 12, marginTop: 16 }}
                                    onPress={() => setShowTelegramFlow(false)}
                                >
                                    <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
                                        Back
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
    },
    modalCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16
    },
    modalContent: {
        borderRadius: 24,
        padding: 24,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: { fontSize: 20, fontWeight: '900' },
});

export default DailyLimitModal;
