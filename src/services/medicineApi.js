import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { API_BASE_URL } from './apiConfig';
const API_URL = `${API_BASE_URL}/api/v1/medicines`;

const medicineApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

medicineApi.interceptors.request.use(
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

export const getMedicines = async (circleId) => {
  const response = await medicineApi.get(`/circles/${circleId}/medicines`);
  return response.data;
};

export const addMedicine = async (circleId, data) => {
  const response = await medicineApi.post('/', { ...data, circle_id: circleId });
  return response.data;
};

export const logAdministration = async (medicineId, status) => {
  const response = await medicineApi.post(`/${medicineId}/logs`, { status });
  return response.data;
};

export const getMedicineAnalytics = async () => {
  const response = await medicineApi.get(`/analytics/compliance`);
  return response.data;
};

export default {
  getMedicines,
  addMedicine,
  logAdministration,
  getMedicineAnalytics,
};
