/**
 * OrderCard — Delivery order card component with glassmorphism design.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import GlassCard from './GlassCard';

export default function OrderCard({ delivery, onComplete }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 80,
                friction: 12,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const customer = delivery.customer || {};
    const items = delivery.items || [];

    return (
        <Animated.View
            style={[
                styles.wrapper,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
        >
            <GlassCard style={styles.card}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.orderBadge}>
                        <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                        <Text style={styles.orderId}>#{delivery.saleId}</Text>
                    </View>
                    {delivery.totalAmount != null && (
                        <Text style={styles.amount}>₺{Number(delivery.totalAmount || 0).toFixed(2)}</Text>
                    )}
                </View>

                {/* Customer Info */}
                {customer.name && (
                    <View style={styles.row}>
                        <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.rowText}>{customer.name}</Text>
                    </View>
                )}

                {customer.address && (
                    <View style={styles.row}>
                        <Ionicons name="location-outline" size={16} color={colors.warning} />
                        <Text style={[styles.rowText, { color: colors.warning }]}>{customer.address}</Text>
                    </View>
                )}

                {/* Items */}
                {items.length > 0 && (
                    <View style={styles.itemsContainer}>
                        <Text style={styles.itemsTitle}>Sipariş İçeriği</Text>
                        {items.map((item, idx) => (
                            <View key={idx} style={styles.itemRow}>
                                <Text style={styles.itemQty}>{item.qty}x</Text>
                                <Text style={styles.itemName}>{item.name}</Text>
                                {item.price != null && (
                                    <Text style={styles.itemPrice}>₺{Number(item.price).toFixed(2)}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Complete Button */}
                <TouchableOpacity
                    style={styles.completeBtn}
                    activeOpacity={0.8}
                    onPress={() => onComplete(delivery.saleId)}
                >
                    <LinearGradient
                        colors={colors.gradientSuccess}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradient}
                    >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.completeBtnText}>Teslim Edildi</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </GlassCard>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 16,
    },
    card: {},
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    orderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryDim,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        gap: 6,
    },
    orderId: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '700',
    },
    amount: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    rowText: {
        color: colors.textSecondary,
        fontSize: 14,
        flex: 1,
    },
    itemsContainer: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginTop: 8,
        paddingTop: 12,
    },
    itemsTitle: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemQty: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '700',
        width: 32,
    },
    itemName: {
        color: colors.text,
        fontSize: 14,
        flex: 1,
    },
    itemPrice: {
        color: colors.textSecondary,
        fontSize: 13,
    },
    completeBtn: {
        marginTop: 16,
        borderRadius: 14,
        overflow: 'hidden',
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    completeBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
