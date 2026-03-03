/**
 * AppNavigator — Conditional auth flow + bottom tab navigation.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet, Platform } from 'react-native';
import { colors } from '../theme/colors';
import { useStore } from '../store/useStore';
import { useLocationTracking } from '../hooks/useLocationTracking';

import LoginScreen from '../screens/LoginScreen';
import OrdersScreen from '../screens/OrdersScreen';
import StatsScreen from '../screens/StatsScreen';

const Tab = createBottomTabNavigator();

function TabBarBackground() {
    return (
        <BlurView
            intensity={60}
            tint="dark"
            style={StyleSheet.absoluteFill}
        />
    );
}

export default function AppNavigator() {
    const isAuthenticated = useStore((s) => s.isAuthenticated);

    // Start location tracking when authenticated
    useLocationTracking();

    if (!isAuthenticated) {
        return <LoginScreen />;
    }

    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.textMuted,
                    tabBarStyle: {
                        position: 'absolute',
                        backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.bgTabBar,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        height: Platform.OS === 'ios' ? 85 : 65,
                        paddingBottom: Platform.OS === 'ios' ? 25 : 8,
                        paddingTop: 8,
                        elevation: 0,
                    },
                    tabBarBackground: Platform.OS === 'ios' ? TabBarBackground : undefined,
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: '600',
                    },
                    tabBarIcon: ({ focused, color, size }) => {
                        let iconName;
                        if (route.name === 'Orders') {
                            iconName = focused ? 'cube' : 'cube-outline';
                        } else if (route.name === 'Stats') {
                            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
                        }
                        return <Ionicons name={iconName} size={size} color={color} />;
                    },
                })}
            >
                <Tab.Screen
                    name="Orders"
                    component={OrdersScreen}
                    options={{ tabBarLabel: 'Siparişler' }}
                />
                <Tab.Screen
                    name="Stats"
                    component={StatsScreen}
                    options={{ tabBarLabel: 'İstatistikler' }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
