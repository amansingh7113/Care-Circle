import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useStore } from '../store/useStore';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://care-circle-backend-hfc0.onrender.com';

export function createApiClient(basePath = '', options = {}) {
  const timeout = options.timeout || 30000;
  const client = axios.create({
    baseURL: `${API_BASE_URL}${basePath}`,
    timeout,
    headers: { 
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true'
    },
  });

  // Request interceptor: attach JWT token
  client.interceptors.request.use(async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Failed to get auth token:', e);
    }
    return config;
  });

  // Response interceptor: handle 401 globally
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        console.warn('401 Unauthorized — clearing session');
        try {
          await AsyncStorage.removeItem('userToken');
          const { clearSession } = useStore.getState();
          clearSession();
          // Navigation reset will be handled by App.js detecting null userSession
        } catch (clearErr) {
          console.error('Session clear error:', clearErr);
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}
