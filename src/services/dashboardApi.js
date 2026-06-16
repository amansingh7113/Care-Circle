import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './apiConfig';

const dashboardApi = axios.create({
  baseURL: `${API_BASE_URL}`,
});

dashboardApi.interceptors.request.use(
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

export const getDashboardAggregated = async (circleId) => {
  const query = circleId ? `?circle_id=${circleId}` : '';
  const response = await dashboardApi.get(`/dashboard${query}`);
  return response.data.data;
};

export default {
  getDashboardAggregated,
};
