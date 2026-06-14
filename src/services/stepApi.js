import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './apiConfig';

const API_URL = `${API_BASE_URL}/api/v1/steps`;

const stepApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
  },
});

stepApi.interceptors.request.use(
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

export const getSteps = async (circleId) => {
  const response = await stepApi.get(`/${circleId}`);
  return response.data;
};

export const syncSteps = async (circleId, date, stepCount) => {
  const response = await stepApi.post('/', {
    circle_id: circleId,
    date,
    step_count: stepCount
  });
  return response.data;
};

export default {
  getSteps,
  syncSteps,
};
