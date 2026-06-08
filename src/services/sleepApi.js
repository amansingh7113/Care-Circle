import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/v1/sleep`;

const sleepApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
  },
});

sleepApi.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error fetching token from storage', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const getSleepLogs = async (circleId) => {
  const response = await sleepApi.get(`/${circleId}`);
  return response.data;
};

// In our automatic architecture, this is primarily called by the background service directly 
// to the backend, but we keep it here in case we need a manual override option.
export const addSleepLog = async (data) => {
  const response = await sleepApi.post('/', data);
  return response.data;
};

export default {
  getSleepLogs,
  addSleepLog,
};
