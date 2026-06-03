import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from './apiConfig';
const API_URL = `${API_BASE_URL}/api/v1/expenses`;

const expenseApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
  },
});

expenseApi.interceptors.request.use(
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

export const getExpensesSummary = async () => {
  const response = await expenseApi.get('/summary');
  return response.data;
};

export const addExpense = async (expenseData) => {
  const response = await expenseApi.post('/', expenseData);
  return response.data;
};

export default {
  getExpensesSummary,
  addExpense,
};
