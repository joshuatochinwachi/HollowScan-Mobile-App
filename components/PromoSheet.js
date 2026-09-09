import React, { useState, useContext } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    Linking,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { UserContext } from '../context/UserContext';
import Constants from '../Constants';

const PromoSheet = ({
    visible,
    onClose,
    telegramLinked,
    user,
    promoCode,
    justActivated,
    isChecking,
    onCheckStatus
}) => {
    const { isDarkMode } = useContext(UserContext);
    const [copied, setCopied] = useState(false);
    const brand = Constants.BRAND;

    const colors = isDarkMode ? {
        card: '#141416',
        cardSecondary: '#1C1C1E',
        cardBorder: 'rgba(255, 255, 255, 0.08)',
        text: '#FFFFFF',
        textSecondary: '#9CA3AF',
        subtext: '#6B7280',
        couponBg: '#0D0E12',
        couponBorder: '#3730A3',
        stepBadgeBg: '#2E285C',
        successBg: 'rgba(16, 185, 129, 0.12)',
        successBorder: 'rgba(16, 185, 129, 0.3)',
    } : {
        card: '#FFFFFF',
        cardSecondary: '#F9FAFB',
        cardBorder: 'rgba(0, 0, 0, 0.08)',
        text: '#111827',
        textSecondary: '#4B5563',
        subtext: '#9CA3AF',
        couponBg: '#F5F7FF',
        couponBorder: '#C7D2FE',
        stepBadgeBg: '#EEF2FF',
        successBg: '#ECFDF5',
        successBorder: 'rgba(16, 185, 129, 0.3)',
    };

    const handleCopyCode = async () => {
        if (!promoCode) return;
        try {
            await Clipboard.setStringAsync(promoCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.log('[CLIPBOARD] Copy failed:', e);
        }
    };

    const handleConnectTelegram = () => {
        if (!user || !user.id) {
            Alert.alert("Account Required", "Please log in to your account first so the bot knows which account to upgrade.");
            return;
        }
        const telegramUrl = `https://t.me/HollowScan_Bot?start=link_${user.id}`;
        Linking.openURL(telegramUrl).catch(() => {
            Alert.alert("Error", "Could not open Telegram. Please search for @HollowScan_Bot manually.");
        });
    };

    const handleOpenBot = () => {
        Linking.openURL("https://t.me/HollowScan_Bot").catch(() => {
            Alert.alert("Error", "Could not open Telegram. Please search for @HollowScan_Bot manually.");
        });
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <BlurView intensity={90} tint={isDarkMode ? 'dark' : 'light'} style={styles.modalOverlay}>
                <TouchableOpacity
                    style={styles.backdropTouch}
                    activeOpacity={1}
                    onPress={onClose}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={[
                            styles.sheetCard,
                            {
                                backgroundColor: colors.card,
                                borderColor: colors.cardBorder
                            }
                        ]}
                    >
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                            contentContainerStyle={{ flexGrow: 1 }}
                        >
                        {justActivated ? (
                            /* --- CELEBRATION / UPGRADE SUCCESS --- */
                            <View style={styles.celebrationContainer}>
                                <View style={styles.celebrationIconBg}>
                                    <Text style={{ fontSize: 44 }}>🎉</Text>
                                </View>
                                <Text style={styles.celebrationTitle}>
                                    Premium Activated!
                                </Text>
                                <Text style={[styles.celebrationSub, { color: colors.textSecondary }]}>
                                    Your account now has full access to real-time restock alerts and unlimited product views.
                                </Text>
                                <View style={styles.syncingPill}>
                                    <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 8 }} />
                                    <Text style={styles.syncingText}>Updating your session...</Text>
                                </View>
                            </View>
                        ) : (
                            /* --- PROMO CONTENT & VOUCHER --- */
                            <>
                                {/* Top Header */}
                                <View style={styles.header}>
                                    <View style={styles.badgeRow}>
                                        <LinearGradient
                                            colors={['#4F46E5', '#6366F1']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.promoPill}
                                        >
                                            <Text style={styles.promoPillText}>LIMITED TIME ACCESS</Text>
                                        </LinearGradient>
                                    </View>
                                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                        <Text style={[styles.closeIcon, { color: colors.subtext }]}>✕</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.mainTitle, { color: colors.text }]}>
                                    Claim Free Premium
                                </Text>
                                <Text style={[styles.description, { color: colors.textSecondary }]}>
                                    Link your Telegram account and redeem your official promo code to unlock full premium features.
                                </Text>

                                {/* PROMO VOUCHER PASS */}
                                {promoCode ? (
                                    <View style={[styles.voucherCard, { backgroundColor: colors.couponBg, borderColor: colors.couponBorder }]}>
                                        <View style={styles.voucherHeader}>
                                            <Text style={[styles.voucherLabel, { color: brand.BLUE }]}>OFFICIAL PROMO CODE</Text>
                                            <View style={styles.activeDot} />
                                        </View>

                                        <View style={styles.codeRow}>
                                            <Text style={[styles.codeText, { color: colors.text }]} numberOfLines={1}>
                                                {promoCode}
                                            </Text>
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={handleCopyCode}
                                                style={[
                                                    styles.copyBtn,
                                                    { backgroundColor: copied ? '#10B981' : brand.BLUE }
                                                ]}
                                            >
                                                <Text style={styles.copyBtnText}>
                                                    {copied ? '✓ Copied' : 'Copy'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : null}

                                {/* STEP 1: Connect Account */}
                                <View style={[styles.stepCard, { backgroundColor: colors.cardSecondary, borderColor: colors.cardBorder }]}>
                                    <View style={styles.stepHeader}>
                                        <View style={[styles.stepNum, { backgroundColor: brand.BLUE }]}>
                                            <Text style={styles.stepNumText}>1</Text>
                                        </View>
                                        <Text style={[styles.stepTitle, { color: colors.text }]}>
                                            Connect Telegram
                                        </Text>
                                    </View>

                                    {telegramLinked ? (
                                        <View style={[styles.linkedCard, { backgroundColor: colors.successBg, borderColor: colors.successBorder }]}>
                                            <Text style={{ fontSize: 16, marginRight: 8 }}>✅</Text>
                                            <Text style={styles.linkedText}>Telegram Account Connected</Text>
                                        </View>
                                    ) : (
                                        <View>
                                            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                                                Link your Telegram account so our bot can instantly verify and sync your status.
                                            </Text>
                                            <TouchableOpacity
                                                activeOpacity={0.88}
                                                onPress={handleConnectTelegram}
                                                style={styles.connectBtn}
                                            >
                                                <Text style={{ fontSize: 15, marginRight: 8 }}>📱</Text>
                                                <Text style={styles.btnText}>Connect Telegram Account</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {/* STEP 2: Redeem in Bot */}
                                <View style={[styles.stepCard, { backgroundColor: colors.cardSecondary, borderColor: colors.cardBorder }]}>
                                    <View style={styles.stepHeader}>
                                        <View style={[styles.stepNum, { backgroundColor: brand.BLUE }]}>
                                            <Text style={styles.stepNumText}>2</Text>
                                        </View>
                                        <Text style={[styles.stepTitle, { color: colors.text }]}>
                                            Redeem in Bot
                                        </Text>
                                    </View>
                                    <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                                        Open <Text style={{ fontWeight: '700', color: colors.text }}>@HollowScan_Bot</Text> and send the promo code to activate.
                                    </Text>
                                    <TouchableOpacity
                                        activeOpacity={0.88}
                                        onPress={handleOpenBot}
                                        style={[styles.openBotBtn, { backgroundColor: brand.BLUE }]}
                                    >
                                        <Text style={{ fontSize: 15, marginRight: 8 }}>💬</Text>
                                        <Text style={styles.btnText}>Open @HollowScan_Bot</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Footer: Realtime Status */}
                                <View style={[styles.footer, { borderTopColor: colors.cardBorder }]}>
                                    <View style={styles.statusIndicator}>
                                        {isChecking ? (
                                            <ActivityIndicator size="small" color={brand.BLUE} style={{ marginRight: 8 }} />
                                        ) : (
                                            <View style={styles.pulseDot} />
                                        )}
                                        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                                            {isChecking ? 'Verifying status...' : 'Waiting for redemption...'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={onCheckStatus} style={styles.checkNowBtn}>
                                        <Text style={[styles.checkNowText, { color: brand.BLUE }]}>Check Status</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdropTouch: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    sheetCard: {
        width: '100%',
        maxWidth: 390,
        maxHeight: '90%',
        borderRadius: 28,
        padding: 24,
        borderWidth: 1.2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    promoPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    promoPillText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeIcon: {
        fontSize: 18,
        fontWeight: '700',
    },
    mainTitle: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 18,
    },
    voucherCard: {
        borderRadius: 16,
        borderWidth: 1.2,
        borderStyle: 'dashed',
        padding: 14,
        marginBottom: 16,
    },
    voucherHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    voucherLabel: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    codeText: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1.5,
        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
        flex: 1,
    },
    copyBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 10,
        marginLeft: 12,
    },
    copyBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '800',
    },
    stepCard: {
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        marginBottom: 12,
    },
    stepHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    stepNum: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    stepNumText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '900',
    },
    stepTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    stepDesc: {
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 10,
    },
    connectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#229ED9',
        paddingVertical: 10,
        borderRadius: 12,
    },
    openBotBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
    },
    btnText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '800',
    },
    linkedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    linkedText: {
        color: '#10B981',
        fontSize: 13,
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
        marginRight: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    checkNowBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    checkNowText: {
        fontSize: 12,
        fontWeight: '800',
    },
    celebrationContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    celebrationIconBg: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    celebrationTitle: {
        color: '#10B981',
        fontSize: 22,
        fontWeight: '900',
        marginTop: 18,
    },
    celebrationSub: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 12,
    },
    syncingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 24,
    },
    syncingText: {
        color: '#10B981',
        fontSize: 13,
        fontWeight: '700',
    },
});

export default PromoSheet;
