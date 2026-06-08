import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/v1/vitals`;

const vitalsApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
  },
});

vitalsApi.interceptors.request.use(
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

export const getVitals = async (circleId) => {
  const response = await vitalsApi.get(`/${circleId}`);
  return response.data;
};

export const logVitals = async (data) => {
  const response = await vitalsApi.post('/', data);
  return response.data;
};

export default {
  getVitals,
  logVitals,
};
