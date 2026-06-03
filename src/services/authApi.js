import axios from 'axios';
import { Platform } from 'react-native';

import { API_BASE_URL } from './apiConfig';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/auth`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

export const sendOtp = async (phone) => {
  const response = await apiClient.post('/send-otp', { phone_number: phone });
  return response.data;
};

export const verifyOtp = async (phone, code) => {
  const response = await apiClient.post('/verify-otp', { phone_number: phone, token: code });
  return response.data;
};

export const getGoogleAuthUrl = async (redirectUri) => {
  const url = redirectUri ? `/google?redirectUri=${encodeURIComponent(redirectUri)}` : '/google';
  const response = await apiClient.get(url);
  return response.data;
};

export const exchangeSession = async (accessToken) => {
  const response = await apiClient.post('/exchange-session', { access_token: accessToken });
  return response.data;
};
