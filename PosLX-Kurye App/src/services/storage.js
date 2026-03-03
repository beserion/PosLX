/**
 * AsyncStorage wrapper for session persistence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = '@poslx_courier_session';

/**
 * Save session data (url, token, courierId) to AsyncStorage.
 */
export async function saveSession(session) {
    try {
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
        console.error('Failed to save session:', err);
    }
}

/**
 * Get stored session data. Returns null if not found.
 */
export async function getSession() {
    try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        console.error('Failed to get session:', err);
        return null;
    }
}

/**
 * Clear session data (logout).
 */
export async function clearSession() {
    try {
        await AsyncStorage.removeItem(SESSION_KEY);
    } catch (err) {
        console.error('Failed to clear session:', err);
    }
}
