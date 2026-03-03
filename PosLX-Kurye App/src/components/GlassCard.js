/**
 * GlassCard — Glassmorphism card wrapper component.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';

export default function GlassCard({ children, style, intensity = 30 }) {
    return (
        <View style={[styles.container, style]}>
            <BlurView intensity={intensity} tint="dark" style={styles.blur}>
                <View style={styles.inner}>{children}</View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    blur: {
        overflow: 'hidden',
    },
    inner: {
        padding: 20,
        backgroundColor: colors.bgCard,
    },
});
