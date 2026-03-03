/**
 * Axios API service — handles all REST calls to PosLX backend.
 */
import axios from 'axios';
import { useStore } from '../store/useStore';

let apiInstance = null;

/**
 * Get or create the axios instance using stored session.
 */
function getApi() {
    const { session, preferPublic, setPreferPublic } = useStore.getState();
    if (!session) return null;

    // Determine primary and fallback URLs
    const hasLan = !!session.lanUrl;
    const hasWan = !!session.url;

    // If we prefer public and have a WAN URL, use it as primary
    const primaryUrl = (preferPublic && hasWan)
        ? session.url
        : (session.lanUrl || session.url);

    const fallbackUrl = (primaryUrl === session.lanUrl) ? session.url : null;

    if (!apiInstance || apiInstance.defaults.baseURL !== primaryUrl) {
        apiInstance = axios.create({
            baseURL: primaryUrl,
            timeout: primaryUrl === session.lanUrl ? 3000 : 10000, // Faster timeout for LAN
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add auth interceptor
        apiInstance.interceptors.request.use((config) => {
            const current = useStore.getState().session;
            if (current?.token) {
                config.headers.Authorization = `Bearer ${current.token}`;
            }
            return config;
        });

        // Add fallback interceptor
        if (fallbackUrl) {
            apiInstance.interceptors.response.use(
                (response) => response, // Pass success through
                async (error) => {
                    const config = error.config;
                    // If network error/timeout on LAN and we haven't retried yet
                    if (!config._retry && primaryUrl === session.lanUrl && (!error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error')) {
                        console.warn(`⚠️ API request failed on LAN ${primaryUrl}, switching to Public ${fallbackUrl}`);

                        // Mark preference for public for subsequent calls
                        setPreferPublic(true);

                        config._retry = true;
                        config.baseURL = fallbackUrl;
                        config.url = config.url.replace(primaryUrl, fallbackUrl);

                        // Create a new fresh axios instance just for the retry
                        const retryClient = axios.create({ timeout: 10000 });
                        return retryClient(config);
                    }
                    return Promise.reject(error);
                }
            );
        }
    }

    return apiInstance;
}

/**
 * Report courier location to backend.
 */
export async function postLocation(courierId, latitude, longitude) {
    const api = getApi();
    if (!api) return;
    try {
        await api.post('/api/couriers/location', { courierId, latitude, longitude });
    } catch (err) {
        console.error('Location post failed:', err.message);
    }
}

/**
 * Update courier status (Idle, Delivering, Offline).
 */
export async function updateStatus(courierId, status) {
    const api = getApi();
    if (!api) return;
    try {
        await api.put(`/api/couriers/${courierId}/status`, { status });
    } catch (err) {
        console.error('Status update failed:', err.message);
    }
}

/**
 * Get courier daily/weekly/monthly stats.
 */
export async function getStats(courierId) {
    const api = getApi();
    if (!api) return null;
    try {
        const res = await api.get(`/api/couriers/${courierId}/stats`);
        return res.data?.data || null;
    } catch (err) {
        console.error('Stats fetch failed:', err.message);
        return null;
    }
}

/**
 * Reset the api instance (on logout).
 */
export function resetApi() {
    apiInstance = null;
}
