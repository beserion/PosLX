/**
 * LoginScreen — QR Code scanner login screen with dark theme.
 */
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Alert,
    Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useStore } from '../store/useStore';
import { saveSession, getSession } from '../services/storage';

export default function LoginScreen() {
    const setSession = useStore((s) => s.setSession);
    const [scanning, setScanning] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    // Auto-login: check stored session on mount
    useEffect(() => {
        (async () => {
            const stored = await getSession();
            if (stored?.url && stored?.token && stored?.courierId) {
                setSession(stored);
            }
        })();
    }, []);

    // Pulse animation for QR button
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    const handleBarCodeScanned = async ({ data }) => {
        try {
            const parsed = JSON.parse(data);

            if (!parsed.url || !parsed.token || !parsed.courierId) {
                Alert.alert('Hata', 'Geçersiz QR kodu. POS ekranındaki kurye QR kodunu okutun.');
                setScanning(false);
                return;
            }

            const session = {
                url: parsed.url,
                lanUrl: parsed.lanUrl || null,
                token: parsed.token,
                courierId: parsed.courierId,
            };

            await saveSession(session);
            setSession(session);
            setScanning(false);
        } catch (err) {
            Alert.alert('Hata', 'QR kodu okunamadı. Lütfen tekrar deneyin.');
            setScanning(false);
        }
    };

    const handleScanPress = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('İzin Gerekli', 'QR kod okutmak için kamera izni gereklidir.');
                return;
            }
        }
        setScanning(true);
    };

    if (scanning) {
        return (
            <View style={styles.cameraContainer}>
                <StatusBar barStyle="light-content" />
                <CameraView
                    style={styles.camera}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={handleBarCodeScanned}
                >
                    {/* Scan overlay */}
                    <View style={styles.overlay}>
                        <View style={styles.scanArea}>
                            {/* Corner markers */}
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>
                        <Text style={styles.scanText}>QR Kodu çerçevenin içine hizalayın</Text>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setScanning(false)}
                        >
                            <Ionicons name="close-circle" size={24} color={colors.text} />
                            <Text style={styles.cancelText}>İptal</Text>
                        </TouchableOpacity>
                    </View>
                </CameraView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={colors.gradientBg} style={styles.gradient}>
                {/* Logo Area */}
                <View style={styles.logoArea}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="bicycle" size={60} color={colors.primary} />
                    </View>
                    <Text style={styles.title}>PosLX</Text>
                    <Text style={styles.subtitle}>Courier</Text>
                    <Text style={styles.desc}>
                        POS ekranındaki QR kodunuzu okutarak{'\n'}giriş yapabilirsiniz
                    </Text>
                </View>

                {/* QR Scan Button */}
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity
                        style={styles.scanButton}
                        activeOpacity={0.85}
                        onPress={handleScanPress}
                    >
                        <LinearGradient
                            colors={colors.gradientPrimary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.scanGradient}
                        >
                            <Ionicons name="qr-code-outline" size={32} color="#fff" />
                            <Text style={styles.scanBtnText}>QR Kod Okut</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>

                {/* Footer */}
                <Text style={styles.footer}>PosLX Courier v1.0</Text>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    logoArea: {
        alignItems: 'center',
        marginBottom: 60,
    },
    logoCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.primaryDim,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: colors.primaryGlow,
    },
    title: {
        fontSize: 42,
        fontWeight: '900',
        color: colors.text,
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '400',
        color: colors.primary,
        letterSpacing: 6,
        textTransform: 'uppercase',
        marginBottom: 16,
    },
    desc: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    scanButton: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12,
    },
    scanGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 18,
        gap: 12,
    },
    scanBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },

    // Camera / Scanner
    cameraContainer: { flex: 1, backgroundColor: '#000' },
    camera: { flex: 1 },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanArea: {
        width: 260,
        height: 260,
        borderRadius: 20,
        backgroundColor: 'transparent',
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: colors.primary,
    },
    topLeft: {
        top: 0, left: 0,
        borderTopWidth: 4, borderLeftWidth: 4,
        borderTopLeftRadius: 20,
    },
    topRight: {
        top: 0, right: 0,
        borderTopWidth: 4, borderRightWidth: 4,
        borderTopRightRadius: 20,
    },
    bottomLeft: {
        bottom: 0, left: 0,
        borderBottomWidth: 4, borderLeftWidth: 4,
        borderBottomLeftRadius: 20,
    },
    bottomRight: {
        bottom: 0, right: 0,
        borderBottomWidth: 4, borderRightWidth: 4,
        borderBottomRightRadius: 20,
    },
    scanText: {
        color: colors.textSecondary,
        fontSize: 14,
        marginTop: 24,
        textAlign: 'center',
    },
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 32,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 14,
    },
    cancelText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        color: colors.textMuted,
        fontSize: 12,
    },
});
