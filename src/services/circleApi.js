import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { API_BASE_URL } from './apiConfig';
const API_URL = `${API_BASE_URL}/api/v1/circles`;

const circleApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
  },
});

// Request interceptor to add the JWT token
circleApi.interceptors.request.use(
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

export const getUserCircles = async () => {
  const response = await circleApi.get('/');
  return response.data;
};

export const createCircle = async (name) => {
  const response = await circleApi.post('/', { name });
  return response.data;
};

export const joinCircle = async (inviteCode) => {
  const response = await circleApi.post('/join', { inviteCode });
  return response.data;
};

export const getCircleDetails = async (id) => {
  const response = await circleApi.get(`/${id}`);
  return response.data;
};

export default {
  getUserCircles,
  createCircle,
  joinCircle,
  getCircleDetails,
};
