import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { API_BASE_URL } from './apiConfig';
const API_URL = `${API_BASE_URL}/api/v1/tasks`;

const taskApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

taskApi.interceptors.request.use(
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

export const getTasks = async (circleId, status = '') => {
  const query = status ? `?status=${status}` : '';
  const response = await taskApi.get(`/circles/${circleId}/tasks${query}`);
  return response.data;
};

export const createTask = async (circleId, taskData) => {
  const response = await taskApi.post('/', { ...taskData, circle_id: circleId });
  return response.data;
};

export const updateTaskStatus = async (taskId, updateData) => {
  const response = await taskApi.patch(`/${taskId}`, updateData);
  return response.data;
};

export default {
  getTasks,
  createTask,
  updateTaskStatus,
};
