import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SOCKET_URL || '';

export const courierSocket = io(`${URL}/couriers`, { autoConnect: false });
export const salesSocket = io(`${URL}/sales`, { autoConnect: false });
