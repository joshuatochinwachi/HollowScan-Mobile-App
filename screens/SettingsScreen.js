import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Switch,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * HollowScan Professional Settings Screen
 */
const SettingsScreen = ({ isDarkMode, onThemeToggle }) => {
    const [telegramLinked, setTelegramLinked] = useState(false);
    const [linkCode, setLinkCode] = useState('');

    const brand = {
        blue: '#2D82FF',
        purple: '#9B4DFF',
        darkBg: '#0A0A0B',
        lightBg: '#F8F9FE',
    };

    const colors = isDarkMode ? {
        bg: brand.darkBg,
        card: '#161618',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        accent: brand.blue,
        border: '#2C2C2E'
    } : {
        bg: brand.lightBg,
        card: '#FFFFFF',
        text: '#1C1C1E',
        textSecondary: '#636366',
        accent: brand.blue,
        border: '#D1D1D6'
    };

    const handleLinkTelegram = () => {
        if (linkCode.length === 6) {
            setTelegramLinked(true);
            Alert.alert("HollowScan", "Telegram account successfully linked!");
        } else {
            Alert.alert("Security", "Please enter a valid 6-digit verification code.");
        }
    };

    const SettingRow = ({ label, value, onToggle, isLast }) => (
        <View style={[styles.row, { borderBottomColor: isLast ? 'transparent' : colors.border }]}>
            <Text style={[styles.rowText, { color: colors.text }]}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: '#3A3A3C', true: brand.blue }}
                thumbColor="#FFF"
            />
        </View>
    );

    return (
        <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                </View>

                {/* APPEARANCE */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE</Text>
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.row}>
                            <Text style={[styles.rowText, { color: colors.text }]}>Dark Mode</Text>
                            <Switch
                                value={isDarkMode}
                                onValueChange={onThemeToggle}
                                trackColor={{ false: '#3A3A3C', true: brand.blue }}
                                thumbColor="#FFF"
                            />
                        </View>
                    </View>
                </View>

                {/* TELEGRAM SYNC */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>IDENTITY SYNC</Text>
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {telegramLinked ? (
                            <View style={styles.linkedRow}>
                                <View>
                                    <Text style={[styles.rowText, { color: colors.text }]}>Linked Identity</Text>
                                    <Text style={[styles.subText, { color: brand.blue }]}>@josh_hollowscan</Text>
                                </View>
                                <TouchableOpacity onPress={() => setTelegramLinked(false)}>
                                    <Text style={{ color: '#FF453A', fontWeight: 'bold' }}>Unlink</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.linkWrapper}>
                                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                    Sync your mobile identity with the Telegram bot to access pro features.
                                </Text>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: isDarkMode ? '#000' : '#F2F2F7' }]}
                                    placeholder="6-Digit Code"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="numeric"
                                    maxLength={6}
                                    value={linkCode}
                                    onChangeText={setLinkCode}
                                />
                                <TouchableOpacity
                                    style={[styles.linkBtn, { backgroundColor: brand.blue }]}
                                    onPress={handleLinkTelegram}
                                >
                                    <Text style={styles.linkBtnText}>VERIFY IDENTITY</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* NOTIFICATIONS */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SMART ALERTS</Text>
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <SettingRow label="US Market" value={true} onToggle={() => { }} />
                        <SettingRow label="UK Market" value={true} onToggle={() => { }} />
                        <SettingRow label="Electronics & Tech" value={true} onToggle={() => { }} />
                        <SettingRow label="Luxury Fashion" value={false} onToggle={() => { }} isLast />
                    </View>
                </View>

                <Text style={[styles.footer, { color: colors.textSecondary }]}>HollowScan Pro v1.0.0 (Beta)</Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 20, paddingTop: 10 },
    headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
    section: { marginTop: 25, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 11, fontWeight: '800', marginBottom: 10, marginLeft: 5, letterSpacing: 1.5 },
    card: { borderRadius: 20, paddingHorizontal: 20, overflow: 'hidden', borderWidth: 1 },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 60,
        borderBottomWidth: 1
    },
    linkedRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 75
    },
    rowText: { fontSize: 16, fontWeight: '700' },
    subText: { fontSize: 14, fontWeight: '600', marginTop: 2 },
    linkWrapper: { paddingVertical: 20 },
    infoText: { fontSize: 13, marginBottom: 20, lineHeight: 20, fontWeight: '500' },
    input: {
        height: 54,
        borderWidth: 1,
        borderRadius: 15,
        paddingHorizontal: 15,
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 20
    },
    linkBtn: { height: 54, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    linkBtnText: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },
    footer: { textAlign: 'center', padding: 40, fontSize: 11, fontWeight: '700', opacity: 0.5, letterSpacing: 1 }
});

export default SettingsScreen;
