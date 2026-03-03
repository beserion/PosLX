import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as TaskManager from 'expo-task-manager';
import AppNavigator from './src/navigation/AppNavigator';
import { useStore } from './src/store/useStore';
import { postLocation } from './src/services/api';

const BACKGROUND_LOCATION_TASK = 'COURIER_BACKGROUND_LOCATION';

// Define the background task at the entry point for reliable registration
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
    if (error) {
        console.error('📍 Background location task error:', error.message);
        return;
    }

    if (data) {
        const { locations } = data;
        const session = useStore.getState().session;

        if (!session?.courierId || !locations || locations.length === 0) return;

        const latest = locations[locations.length - 1];
        const { latitude, longitude } = latest.coords;

        console.log('📍 Background location update:', latitude, longitude);
        postLocation(session.courierId, latitude, longitude);
    }
});

export default function App() {
    return (
        <SafeAreaProvider>
            <AppNavigator />
        </SafeAreaProvider>
    );
}
