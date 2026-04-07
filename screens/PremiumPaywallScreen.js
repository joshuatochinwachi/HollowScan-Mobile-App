import React, { useContext, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Dimensions,
    Image,
    SafeAreaView,
    Platform,
    Alert,
    Linking,
    StatusBar
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { UserContext } from '../context/UserContext';
import Constants from '../Constants';
import SubscriptionService from '../services/SubscriptionService';
import { formatIAPPrice } from '../utils/format';

const { width } = Dimensions.get('window');

const PremiumPaywallScreen = ({ navigation }) => {
    console.log('[NAV] Mounted: PremiumPaywallScreen');
    const { isDarkMode, purchasePremium, getPlanPrice, isPremium, isTrialEligible, subscriptionPlans } = useContext(UserContext);
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);

    const monthlyPriceData = (() => {
        try {
            const str = getPlanPrice('premium_monthly') || '£4.99';
            const val = parseFloat(str.replace(/[^0-9.]/g, '')) || 4.99;
            const display = formatIAPPrice(str);
            return { val, display };
        } catch (e) {
            console.warn('[PAYWALL] Monthly price parse error:', e);
            return { val: 4.99, display: '£4.99' };
        }
    })();

    const yearlyPriceData = (() => {
        try {
            const str = getPlanPrice('premium_yearly') || '£55.50';
            const val = parseFloat(str.replace(/[^0-9.]/g, '')) || 55.50;
            const display = formatIAPPrice(str);
            return { val, display };
        } catch (e) {
            console.warn('[PAYWALL] Yearly price parse error:', e);
            return { val: 55.50, display: '£55.50' };
        }
    })();

    const yearlySavingLabel = (() => {
        try {
            const monthly = monthlyPriceData.val;
            const yearly = yearlyPriceData.val;
            if (!monthly || !yearly || monthly <= 0) return 'BEST VALUE';
            
            const annualMonthly = monthly * 12;
            if (annualMonthly <= 0) return 'BEST VALUE'; // ← ZERO DIVISION GUARD
            
            const saving = Math.round(((annualMonthly - yearly) / annualMonthly) * 100);
            if (isFinite(saving) && saving > 0) return `SAVE ${saving}%`;
            return 'BEST VALUE';
        } catch (e) {
            console.warn('[PAYWALL] Error calculating savings:', e);
            return 'BEST VALUE';
        }
    })();

    const brand = Constants.BRAND;
    
    // OG Dev Palette: Sophisticated, high-contrast, clean.
    const colors = isDarkMode ? {
        bg: '#000000',
        card: '#1C1C1E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
        primary: brand.BLUE,
        accent: '#5E5CE6',
        success: '#32D74B'
    } : {
        bg: '#F2F2F7',
        card: '#FFFFFF',
        text: '#000000',
        textSecondary: '#8E8E93',
        border: '#C6C6C8',
        primary: brand.BLUE,
        accent: '#007AFF',
        success: '#34C759'
    };

    const handlePurchase = async (type, isTrialIntent = false) => {
        setLoading(true);
        try {
            // 🛡️ IRON-CLAD SAFETY GATE: Final check before triggering native sheet
            const finalTrialIntent = isTrialIntent && isTrialEligible;
            console.log(`[PAYWALL] Starting purchase flow for: ${type} (Requested Trial: ${isTrialIntent}, Final Trial: ${finalTrialIntent})`);
            
            const result = await purchasePremium(type, finalTrialIntent);
            console.log(`[PAYWALL] Bridge result for ${type}:`, result);
            
            if (!result.success) {
                if (result.message && result.message !== 'Purchase cancelled') {
                    Alert.alert("Payment Issue", result.message);
                } else {
                    console.log('[PAYWALL] Purchase was cancelled by user');
                }
            }
        } catch (e) {
            console.error('[PAYWALL] Unexpected Exception:', e);
            Alert.alert("Error", "An unexpected error occurred during purchase: " + (e.message || 'Unknown Error'));
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        setRestoring(true);
        try {
            const success = await SubscriptionService.restorePurchases();
            if (success) {
                Alert.alert("Success", "Your Premium access has been restored! 🚀");
                navigation.goBack();
            } else {
                Alert.alert("Restore", "We couldn't find an active subscription associated with this account.");
            }
        } catch (e) {
            Alert.alert("Error", "Could not complete restore: " + e.message);
        } finally {
            setRestoring(false);
        }
    };

    const FeatureRow = ({ title, desc }) => (
        <View style={styles.featureRow}>
            <View style={[styles.checkCircle, { backgroundColor: colors.success + '20' }]}>
                <Text style={{ color: colors.success, fontSize: 12, fontWeight: '900' }}>✓</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.featureText, { color: colors.text }]}>{title}</Text>
                {desc && <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{desc}</Text>}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* Close Button - Clean & Minimal */}
                <TouchableOpacity 
                    style={styles.closeBtn} 
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>

                {/* Hero Branding */}
                <View style={styles.hero}>
                    <Text style={[styles.kicker, { color: colors.accent }]}>UNLIMITED ACCESS</Text>
                    <Text style={[styles.title, { color: colors.text }]}>HollowScan Premium</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Join thousands of professional resellers using real-time data to dominate the market.
                    </Text>
                </View>

                {/* Feature List - Professional Density */}
                <View style={styles.featuresCard}>
                    <FeatureRow title="Global Arbitrage Feed" desc="Infinite scroll of deals from USA, UK, and CA." />
                    <FeatureRow title="Zero Restrictions" desc="Remove all blurs and viewing limits permanently." />
                    <FeatureRow title="Priority Push Alerts" desc="Be the first to know when high-ROI items drop." />
                    <FeatureRow title="Deep Market Analytics" desc="See product pricing and store inventory metrics." />
                </View>

                {/* Pricing Plans */}
                <View style={styles.pricingContainer}>
                    {loading ? (
                        <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 40 }} />
                    ) : (
                        <>
                            {/* Monthly Plan - Conditional Trial Eligibility */}
                            <TouchableOpacity 
                                style={[styles.planCard, { backgroundColor: colors.card, borderColor: isTrialEligible ? colors.accent : colors.border }]}
                                onPress={() => handlePurchase('monthly', isTrialEligible)}
                                activeOpacity={0.9}
                            >
                                <View style={styles.planHeader}>
                                    <View>
                                        <Text style={[styles.planName, { color: colors.text }]}>Monthly</Text>
                                        <Text style={[styles.planPrice, { color: colors.text }]}>{monthlyPriceData.display}<Text style={styles.perMonth}>/mo</Text></Text>
                                    </View>
                                    {isTrialEligible && (
                                        <View style={[styles.trialBadge, { backgroundColor: colors.accent }]}>
                                            <Text style={styles.trialBadgeText}>3 DAYS FREE</Text>
                                        </View>
                                    )}
                                </View>
                                
                                <LinearGradient
                                    colors={isTrialEligible ? [colors.accent, '#833AB4'] : [colors.card, colors.card]}
                                    style={styles.actionBtn}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={[styles.actionBtnText, { color: isTrialEligible ? '#FFF' : colors.accent }]}>
                                        {isTrialEligible ? 'Start Free Trial' : 'Get Started'}
                                    </Text>
                                </LinearGradient>
                                <Text style={[styles.billingSubtext, { color: colors.textSecondary }]}>
                                    {isTrialEligible ? 'Then regular price. Cancel anytime' : 'Billed monthly. Cancel anytime.'}
                                </Text>
                            </TouchableOpacity>

                            {/* Yearly Plan - The "Pro" Choice */}
                            <TouchableOpacity 
                                style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}
                                onPress={() => handlePurchase('yearly')}
                                activeOpacity={0.9}
                            >
                                <View style={styles.planHeader}>
                                    <View>
                                        <Text style={[styles.planName, { color: colors.text }]}>Yearly Pro</Text>
                                        <Text style={[styles.planPrice, { color: colors.text }]}>{yearlyPriceData.display}<Text style={styles.perMonth}>/yr</Text></Text>
                                    </View>
                                    <View style={[styles.valueBadge, { backgroundColor: colors.success }]}>
                                        <Text style={styles.valueBadgeText}>{yearlySavingLabel}</Text>
                                    </View>
                                </View>
                                
                                <View style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#2C2C2E' : '#E5E5EA' }]}>
                                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Subscribe Yearly</Text>
                                </View>
                                <Text style={[styles.billingSubtext, { color: colors.textSecondary }]}>
                                    Direct access. Best value for serious traders.
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Footer Section */}
                <View style={styles.footer}>
                    <TouchableOpacity onPress={handleRestore} disabled={restoring}>
                        <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>
                            {restoring ? 'Restoring...' : 'Restore Purchases'}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.legalLinks}>
                        {Platform.OS === 'ios' && (
                            <>
                                <TouchableOpacity onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
                                    <Text style={[styles.legalText, { color: colors.textSecondary }]}>Terms of Use (EULA)</Text>
                                </TouchableOpacity>
                                <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
                            </>
                        )}
                        <TouchableOpacity onPress={() => Linking.openURL('https://www.hollowscan.com/privacy-policy')}>
                            <Text style={[styles.legalText, { color: colors.textSecondary }]}>Privacy Policy</Text>
                        </TouchableOpacity>
                    </View>
                    
                    {/* 🕵️ Diagnostic Truth-Mode - Only visible if IAP fetch fails! */}
                    {(!subscriptionPlans || subscriptionPlans.length === 0) && (
                        <View style={{ marginTop: 20, padding: 10, backgroundColor: colors.border + '20', borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                [DEBUG] ID: com.kttylabs.app | API Connection Failed - Using Failover Pricing
                            </Text>
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60 },
    closeBtn: { position: 'absolute', top: 20, left: 24, zIndex: 10 },
    closeIcon: { fontSize: 20, fontWeight: '300' },
    hero: { alignItems: 'center', marginBottom: 32 },
    kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
    title: { fontSize: 28, fontWeight: '800', marginBottom: 12, textAlign: 'center', letterSpacing: -0.5 },
    subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, opacity: 0.8 },
    featuresCard: { marginBottom: 32, paddingVertical: 10 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
    checkCircle: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 14, marginTop: 2 },
    featureText: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    featureDesc: { fontSize: 14, lineHeight: 18 },
    pricingContainer: { width: '100%', marginBottom: 40 },
    planCard: { padding: 20, borderRadius: 24, borderWidth: 1.5 },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    planName: { fontSize: 16, fontWeight: '600', marginBottom: 4, opacity: 0.6 },
    planPrice: { fontSize: 26, fontWeight: '800' },
    perMonth: { fontSize: 16, fontWeight: '500', opacity: 0.5 },
    trialBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    trialBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
    valueBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    valueBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
    actionBtn: { height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    actionBtnText: { fontSize: 17, fontWeight: '800' },
    billingSubtext: { textAlign: 'center', fontSize: 12, opacity: 0.7 },
    footer: { alignItems: 'center' },
    footerBtnText: { fontSize: 14, fontWeight: '700', marginBottom: 20 },
    legalLinks: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    legalText: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
    dot: { marginHorizontal: 8 },
    disclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 16, opacity: 0.6, paddingHorizontal: 10 }
});

export default PremiumPaywallScreen;
