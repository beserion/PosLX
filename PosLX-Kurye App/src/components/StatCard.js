/**
 * StatCard — Statistics badge component for profile/stats screen.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import GlassCard from './GlassCard';

export default function StatCard({ icon, label, value, unit, color = colors.primary }) {
    return (
        <GlassCard style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={styles.value}>
                {value}
                {unit ? <Text style={styles.unit}> {unit}</Text> : null}
            </Text>
            <Text style={styles.label}>{label}</Text>
        </GlassCard>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        alignItems: 'center',
        minWidth: 140,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    value: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
    },
    unit: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
