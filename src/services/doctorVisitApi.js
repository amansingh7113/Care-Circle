import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from './apiConfig';
const API_URL = `${API_BASE_URL}/api/v1/doctor-visits`;

const doctorVisitApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
  },
});

doctorVisitApi.interceptors.request.use(
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

export const getDoctorVisits = async (circleId) => {
  const query = circleId ? `?circle_id=${circleId}` : '';
  const response = await doctorVisitApi.get(`/${query}`);
  return response.data;
};

export const addDoctorVisit = async (visitData) => {
  const response = await doctorVisitApi.post('/', visitData);
  return response.data;
};

export default {
  getDoctorVisits,
  addDoctorVisit,
};
