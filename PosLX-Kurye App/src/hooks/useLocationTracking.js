/**
 * useLocationTracking — Background location tracking hook.
 * Uses expo-task-manager + expo-location for TRUE background location updates.
 * Reports courier position to backend every ~10 seconds or 20m movement,
 * even when the app is in the background.
 */
import { useEffect } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useStore } from '../store/useStore';
import { postLocation } from '../services/api';

const BACKGROUND_LOCATION_TASK = 'COURIER_BACKGROUND_LOCATION';

export function useLocationTracking() {
    const isAuthenticated = useStore((s) => s.isAuthenticated);
    const session = useStore((s) => s.session);

    useEffect(() => {
        let isMounted = true;

        async function startTracking() {
            if (!isAuthenticated || !session?.courierId) {
                console.log('📍 Location tracking skipped: not authenticated');
                return;
            }

            try {
                // Request foreground permissions first
                const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
                if (fgStatus !== 'granted') {
                    console.warn('📍 Foreground location permission denied');
                    return;
                }
                console.log('📍 Foreground location permission granted');

                // Request background permissions
                const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
                if (bgStatus !== 'granted') {
                    console.warn('📍 Background location permission denied — falling back to foreground only');
                }
                console.log('📍 Background location permission:', bgStatus);

                // Send initial location
                const currentLoc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                console.log('📍 Current location:', currentLoc.coords.latitude, currentLoc.coords.longitude);
                await postLocation(session.courierId, currentLoc.coords.latitude, currentLoc.coords.longitude);
                console.log('📍 Initial location sent to server');

                // Check if background task is already running
                const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
                if (hasStarted) {
                    console.log('📍 Background location task already running, stopping first...');
                    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                }

                // Start background location updates
                if (bgStatus === 'granted') {
                    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 10000,        // 10 seconds
                        distanceInterval: 20,        // 20 meters
                        deferredUpdatesInterval: 10000,
                        deferredUpdatesDistance: 20,
                        showsBackgroundLocationIndicator: true,
                        foregroundService: {
                            notificationTitle: 'PosLX Courier',
                            notificationBody: 'Konum takibi aktif',
                            notificationColor: '#6C63FF',
                        },
                    });
                    console.log('📍 Background location tracking started');
                } else {
                    // Fallback: Foreground-only tracking
                    console.log('📍 Starting foreground-only location tracking');
                    await Location.watchPositionAsync(
                        {
                            accuracy: Location.Accuracy.High,
                            timeInterval: 10000,
                            distanceInterval: 20,
                        },
                        (location) => {
                            if (!isMounted) return;
                            const { latitude, longitude } = location.coords;
                            console.log('📍 Foreground location update:', latitude, longitude);
                            postLocation(session.courierId, latitude, longitude);
                        }
                    );
                }
            } catch (err) {
                console.error('📍 Location tracking error:', err.message);
            }
        }

        startTracking();

        return () => {
            isMounted = false;
            // Stop background location when unmounting (logout)
            Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
                .then((hasStarted) => {
                    if (hasStarted) {
                        Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                        console.log('📍 Background location tracking stopped');
                    }
                })
                .catch(() => { });
        };
    }, [isAuthenticated, session?.courierId]);
}
