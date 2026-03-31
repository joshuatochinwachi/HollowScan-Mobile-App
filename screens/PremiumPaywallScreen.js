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
    Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { UserContext } from '../context/UserContext';
import Constants from '../Constants';
import SubscriptionService from '../services/SubscriptionService';

const { width } = Dimensions.get('window');

const PremiumPaywallScreen = ({ navigation }) => {
    const { isDarkMode, purchasePremium, getPlanPrice, isPremium } = useContext(UserContext);
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);

    const brand = Constants.BRAND;
    const colors = isDarkMode ? {
        bg: brand.DARK_BG,
        text: '#FFFFFF',
        textSecondary: '#A1A1AA',
        card: '#161618',
        border: 'rgba(255,255,255,0.08)'
    } : {
        bg: '#F8F9FE',
        text: '#111827',
        textSecondary: '#6B7280',
        card: '#FFFFFF',
        border: 'rgba(0,0,0,0.05)'
    };

    const handlePurchase = async (type) => {
        setLoading(true);
        try {
            const result = await purchasePremium(type);
            if (result.success) {
                // Subscription successful! UserContext will update state
                // and navigation is handled by the Root/Auth logic in App.js usually,
                // but we can also pop or navigate back here.
                Alert.alert("Success", "Welcome to HollowScan Premium! 🚀");
                navigation.goBack();
            } else if (result.message !== 'Purchase cancelled') {
                Alert.alert("Error", result.message || "Purchase failed");
            }
        } catch (e) {
            Alert.alert("Error", e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        setRestoring(true);
        try {
            const success = await SubscriptionService.restorePurchases();
            if (success) {
                Alert.alert("Success", "Your purchases have been restored! 🎉");
                navigation.goBack();
            } else {
                Alert.alert("Info", "No active subscriptions found to restore.");
            }
        } catch (e) {
            Alert.alert("Error", "Restore failed: " + e.message);
        } finally {
            setRestoring(false);
        }
    };

    const PerkItem = ({ icon, title, desc }) => (
        <View style={styles.perkContainer}>
            <View style={[styles.perkIcon, { backgroundColor: brand.PURPLE + '15' }]}>
                <Text style={{ fontSize: 22 }}>{icon}</Text>
            </View>
            <View style={styles.perkText}>
                <Text style={[styles.perkTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.perkDesc, { color: colors.textSecondary }]}>{desc}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header Section */}
                <View style={styles.header}>
                    <TouchableOpacity 
                        style={styles.closeButton} 
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={{ fontSize: 24, color: colors.textSecondary }}>✕</Text>
                    </TouchableOpacity>
                    
                    <LinearGradient
                        colors={[brand.PURPLE, brand.BLUE]}
                        style={styles.logoBadge}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.logoEmoji}>👑</Text>
                    </LinearGradient>
                    
                    <Text style={[styles.title, { color: colors.text }]}>HollowScan Premium</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Unlock 1,000+ daily high-profit deals and global marketplace coverage.
                    </Text>
                </View>

                {/* Benefits Section */}
                <View style={styles.benefits}>
                    <PerkItem 
                        icon="🚀" 
                        title="Infinite Deal Access" 
                        desc="No more daily limits. See every profitable drop as it happens." 
                    />
                    <PerkItem 
                        icon="🌍" 
                        title="Global Coverage" 
                        desc="Full access to US, UK, and CA deals with real-time currency sync." 
                    />
                    <PerkItem 
                        icon="⚡" 
                        title="Instant ROI Alerts" 
                        desc="Priority push notifications for the highest margin opportunities." 
                    />
                    <PerkItem 
                        icon="🔒" 
                        title="3-Day Free Trial" 
                        desc="Start today for $0.00. Absolute transparency, cancel anytime." 
                    />
                </View>

                {/* Action Section */}
                <View style={styles.actions}>
                    {loading ? (
                        <ActivityIndicator size="large" color={brand.BLUE} style={{ marginVertical: 30 }} />
                    ) : (
                        <View style={styles.planContainer}>
                            {/* Monthly Plan - High Conversion + Trial */}
                            <TouchableOpacity 
                                style={[styles.planCard, { borderColor: brand.BLUE, backgroundColor: colors.card }]}
                                onPress={() => handlePurchase('monthly')}
                                activeOpacity={0.8}
                            >
                                <View style={styles.planHeader}>
                                    <Text style={[styles.planTitle, { color: colors.text }]}>Monthly Premium</Text>
                                    <View style={[styles.trialBadge, { backgroundColor: brand.BLUE }]}>
                                        <Text style={styles.trialBadgeText}>3 DAYS FREE</Text>
                                    </View>
                                </View>
                                <Text style={[styles.planPrice, { color: colors.text }]}>{getPlanPrice('premium_monthly')}<Text style={styles.planPeriod}> / month</Text></Text>
                                <Text style={[styles.planInfo, { color: colors.textSecondary }]}>Try full access for free. Cancel anytime before the trial ends.</Text>
                                
                                <LinearGradient
                                    colors={[brand.BLUE, brand.PURPLE]}
                                    style={styles.planActionBtn}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.planActionText}>Start Free Trial</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Yearly Plan - Direct Pay + Savings */}
                            <TouchableOpacity 
                                style={[styles.planCard, { borderColor: colors.border, backgroundColor: colors.card, marginTop: 16 }]}
                                onPress={() => handlePurchase('yearly')}
                                activeOpacity={0.8}
                            >
                                <View style={styles.planHeader}>
                                    <Text style={[styles.planTitle, { color: colors.text }]}>Yearly Access</Text>
                                    <View style={[styles.saveBadge, { backgroundColor: '#10B981' }]}>
                                        <Text style={styles.saveBadgeText}>BEST VALUE 👑</Text>
                                    </View>
                                </View>
                                <Text style={[styles.planPrice, { color: colors.text }]}>{getPlanPrice('premium_yearly')}<Text style={styles.planPeriod}> / year</Text></Text>
                                <Text style={[styles.planInfo, { color: colors.textSecondary }]}>Best for professionals. Direct yearly access with no recurring monthly trials.</Text>

                                <View style={[styles.planActionBtn, { backgroundColor: isDarkMode ? '#222' : '#F3F4F6', borderWidth: 0 }]}>
                                    <Text style={[styles.planActionText, { color: colors.text }]}>Subscribe Yearly</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Footer Links */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleRestore} disabled={restoring}>
                            {restoring ? (
                                <ActivityIndicator size="small" color={colors.textSecondary} />
                            ) : (
                                <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Restore Purchase</Text>
                            )}
                        </TouchableOpacity>
                        
                        <View style={styles.dot} />
                        
                        <TouchableOpacity onPress={() => Linking.openURL('https://hollowscan.com/privacy')}>
                            <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Privacy Policy</Text>
                        </TouchableOpacity>

                        <View style={styles.dot} />

                        <TouchableOpacity onPress={() => Linking.openURL('https://hollowscan.com/terms')}>
                            <Text style={[styles.footerLink, { color: colors.textSecondary }]}>Terms</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={styles.maybeLater} 
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={[styles.maybeLaterText, { color: colors.textSecondary }]}>Maybe later, I'll stick to limited viewing</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
    header: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
    closeButton: { alignSelf: 'flex-start', padding: 8, marginBottom: 10 },
    logoBadge: {
        width: 70,
        height: 70,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        elevation: 10,
        shadowOpacity: 0.3,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 }
    },
    logoEmoji: { fontSize: 35 },
    title: { fontSize: 30, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },
    benefits: { marginBottom: 40 },
    perkContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    perkIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    perkText: { flex: 1 },
    perkTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    perkDesc: { fontSize: 14, lineHeight: 20 },
    actions: { width: '100%' },
    planContainer: { width: '100%', marginBottom: 20 },
    planCard: { 
        width: '100%', 
        padding: 20, 
        borderRadius: 20, 
        borderWidth: 2, 
        elevation: 4,
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }
    },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    planTitle: { fontSize: 18, fontWeight: '800' },
    planPrice: { fontSize: 24, fontWeight: '900', marginBottom: 8 },
    planPeriod: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
    planInfo: { fontSize: 13, lineHeight: 18, marginBottom: 20 },
    trialBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    trialBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
    saveBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    saveBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
    planActionBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    planActionText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
    footerLink: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#A1A1AA', marginHorizontal: 10 },
    maybeLater: { alignSelf: 'center', padding: 10 },
    maybeLaterText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline', opacity: 0.7 }
});

export default PremiumPaywallScreen;
