/**
 * StatsScreen — Courier statistics and profile screen.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    StatusBar,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useStore } from '../store/useStore';
import { getStats } from '../services/api';
import { clearSession } from '../services/storage';
import { disconnectSocket } from '../services/socket';
import StatCard from '../components/StatCard';
import GlassCard from '../components/GlassCard';

export default function StatsScreen() {
    const insets = useSafeAreaInsets();
    const session = useStore((s) => s.session);
    const stats = useStore((s) => s.stats);
    const setStats = useStore((s) => s.setStats);
    const logout = useStore((s) => s.logout);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = useCallback(async () => {
        if (!session?.courierId) return;
        const data = await getStats(session.courierId);
        if (data) {
            setStats(data);
        }
    }, [session?.courierId]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchStats();
        setRefreshing(false);
    }, [fetchStats]);

    const handleLogout = () => {
        Alert.alert(
            'Çıkış Yap',
            'Oturumunuzdan çıkmak istediğinize emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Çıkış',
                    style: 'destructive',
                    onPress: async () => {
                        disconnectSocket();
                        await clearSession();
                        logout();
                    },
                },
            ]
        );
    };

    const daily = stats?.daily || { packagesDelivered: 0, distanceKm: 0 };
    const weekly = stats?.weekly || { packagesDelivered: 0, distanceKm: 0 };
    const monthly = stats?.monthly || { packagesDelivered: 0, distanceKm: 0 };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={colors.gradientBg} style={styles.gradient}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    contentContainerStyle={styles.scroll}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>İstatistikler</Text>
                        <Text style={styles.headerSub}>Kurye #{session?.courierId}</Text>
                    </View>

                    {/* Today Section */}
                    <Text style={styles.sectionTitle}>Bugün</Text>
                    <View style={styles.row}>
                        <StatCard
                            icon="cube"
                            label="Paket"
                            value={daily.packagesDelivered}
                            color={colors.primary}
                        />
                        <View style={{ width: 12 }} />
                        <StatCard
                            icon="speedometer"
                            label="Mesafe"
                            value={Number(daily.distanceKm).toFixed(1)}
                            unit="km"
                            color={colors.secondary}
                        />
                    </View>

                    {/* Weekly Section */}
                    <Text style={styles.sectionTitle}>Bu Hafta</Text>
                    <View style={styles.row}>
                        <StatCard
                            icon="cube"
                            label="Paket"
                            value={weekly.packagesDelivered}
                            color={colors.success}
                        />
                        <View style={{ width: 12 }} />
                        <StatCard
                            icon="speedometer"
                            label="Mesafe"
                            value={Number(weekly.distanceKm).toFixed(1)}
                            unit="km"
                            color={colors.warning}
                        />
                    </View>

                    {/* Monthly Section */}
                    <Text style={styles.sectionTitle}>Bu Ay</Text>
                    <View style={styles.row}>
                        <StatCard
                            icon="cube"
                            label="Paket"
                            value={monthly.packagesDelivered}
                            color={colors.primary}
                        />
                        <View style={{ width: 12 }} />
                        <StatCard
                            icon="speedometer"
                            label="Mesafe"
                            value={Number(monthly.distanceKm).toFixed(1)}
                            unit="km"
                            color={colors.danger}
                        />
                    </View>

                    {/* Logout Button */}
                    <TouchableOpacity
                        style={styles.logoutBtn}
                        activeOpacity={0.8}
                        onPress={handleLogout}
                    >
                        <GlassCard style={styles.logoutCard}>
                            <View style={styles.logoutInner}>
                                <Ionicons name="log-out-outline" size={22} color={colors.danger} />
                                <Text style={styles.logoutText}>Oturumu Kapat</Text>
                            </View>
                        </GlassCard>
                    </TouchableOpacity>
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    gradient: { flex: 1 },
    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    header: {
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
    },
    headerSub: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textSecondary,
        marginTop: 24,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    row: {
        flexDirection: 'row',
    },
    logoutBtn: {
        marginTop: 40,
    },
    logoutCard: {},
    logoutInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    logoutText: {
        color: colors.danger,
        fontSize: 16,
        fontWeight: '700',
    },
});
