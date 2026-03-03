/**
 * OrdersScreen — Active deliveries screen with real-time Socket.io updates.
 */
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    StatusBar,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useStore } from '../store/useStore';
import {
    connectSocket,
    registerCourier,
    onNewDeliveries,
    onDeliveryCompleted,
    completeDelivery,
    disconnectSocket,
} from '../services/socket';
import { updateStatus } from '../services/api';
import { clearSession } from '../services/storage';
import OrderCard from '../components/OrderCard';

export default function OrdersScreen() {
    const insets = useSafeAreaInsets();
    const session = useStore((s) => s.session);
    const deliveries = useStore((s) => s.deliveries);
    const addDeliveries = useStore((s) => s.addDeliveries);
    const removeDelivery = useStore((s) => s.removeDelivery);
    const status = useStore((s) => s.status);
    const setStatus = useStore((s) => s.setStatus);
    const logout = useStore((s) => s.logout);
    const socketStatus = useStore((s) => s.socketStatus);
    const socketError = useStore((s) => s.socketError);
    const [isOnline, setIsOnline] = useState(false);

    // Connect socket on mount
    useEffect(() => {
        if (!session) return;

        connectSocket(session.url, session.lanUrl, session.token, session.courierId);

        // Set up delivery listeners
        onNewDeliveries((data) => {
            console.log('📦 new_deliveries received:', JSON.stringify(data));
            let deliveryArray;
            if (data && data.deliveries && Array.isArray(data.deliveries)) {
                deliveryArray = data.deliveries;
            } else if (Array.isArray(data)) {
                deliveryArray = data;
            } else {
                deliveryArray = [data];
            }
            addDeliveries(deliveryArray);
            setStatus('Delivering');
        });

        onDeliveryCompleted((data) => {
            if (data?.deliveryId) {
                removeDelivery(data.deliveryId);
            }
        });

        return () => {
            // Don't disconnect on cleanup — socket persists across re-renders
        };
    }, [session]);

    // Sync isOnline with socketStatus
    useEffect(() => {
        if (socketStatus === 'connected') {
            setIsOnline(true);
            updateStatus(session?.courierId, 'Idle');
        } else {
            setIsOnline(false);
        }
    }, [socketStatus]);

    const handleComplete = (saleId) => {
        if (!session) return;
        completeDelivery(session.courierId, saleId);
        removeDelivery(saleId);

        const remaining = deliveries.filter((d) => d.saleId !== saleId);
        if (remaining.length === 0) {
            updateStatus(session.courierId, 'Idle');
            setStatus('Idle');
        }
    };

    const toggleOnline = () => {
        if (!session) return;
        const newOnline = !isOnline;
        setIsOnline(newOnline);

        const newStatus = newOnline ? 'Idle' : 'Offline';
        updateStatus(session.courierId, newStatus);
        setStatus(newStatus);
    };

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

    const getConnectionBadge = () => {
        if (socketStatus === 'connected') return null;

        const isError = socketStatus === 'error';
        return (
            <View style={[styles.connectionBanner, { backgroundColor: isError ? colors.dangerDim : colors.warningDim }]}>
                <Ionicons
                    name={isError ? 'warning-outline' : 'sync-outline'}
                    size={16}
                    color={isError ? colors.danger : colors.warning}
                />
                <Text style={[styles.connectionText, { color: isError ? colors.danger : colors.warning }]}>
                    {isError ? `Bağlantı hatası: ${socketError}` : 'Sunucuya bağlanılıyor...'}
                </Text>
            </View>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
                <Ionicons name="cube-outline" size={64} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Sipariş Yok</Text>
            <Text style={styles.emptyDesc}>
                POS'tan yeni sipariş atandığında{'\n'}burada görünecektir
            </Text>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={colors.gradientBg} style={styles.gradient}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Siparişlerim</Text>
                        <Text style={styles.headerSub}>
                            {deliveries.length > 0
                                ? `${deliveries.length} aktif teslimat`
                                : 'Sipariş bekleniyor...'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.statusToggle,
                            { backgroundColor: isOnline ? colors.successDim : colors.dangerDim },
                        ]}
                        onPress={toggleOnline}
                        activeOpacity={0.7}
                    >
                        <View
                            style={[
                                styles.statusDot,
                                { backgroundColor: isOnline ? colors.success : colors.danger },
                            ]}
                        />
                        <Text
                            style={[
                                styles.statusText,
                                { color: isOnline ? colors.success : colors.danger },
                            ]}
                        >
                            {isOnline ? 'Online' : 'Offline'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.logoutBtn}
                        onPress={handleLogout}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="log-out-outline" size={24} color={colors.danger} />
                    </TouchableOpacity>
                </View>

                {/* Connection Status Banner */}
                {getConnectionBadge()}

                {/* Deliveries List */}
                <FlatList
                    data={deliveries}
                    keyExtractor={(item) => String(item.saleId)}
                    renderItem={({ item }) => (
                        <OrderCard delivery={item} onComplete={handleComplete} />
                    )}
                    ListEmptyComponent={renderEmpty}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    gradient: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 10,
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
    statusToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        gap: 6,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '700',
    },
    logoutBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: colors.dangerDim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 20,
        marginBottom: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    connectionText: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    list: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 120,
    },
    emptyIconWrap: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.bgCardLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.textSecondary,
        marginBottom: 8,
    },
    emptyDesc: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
    },
});
