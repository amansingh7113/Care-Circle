import axios from 'axios';
import { Platform } from 'react-native';

import { API_BASE_URL } from './apiConfig';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/auth`,
  timeout: 60000, // Increased to 60s to survive Render cold starts
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
  // Bypass backend to guarantee prompt=consent and skip Render sleep delays
  const supabaseUrl = 'https://tslppywdlbayvgtuqpqb.supabase.co';
  const url = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}&prompt=consent`;
  return { url };
};

export const exchangeSession = async (accessToken) => {
  const response = await apiClient.post('/exchange-session', { access_token: accessToken });
  return response.data;
};

export const registerEmail = async (email, password) => {
  const response = await apiClient.post('/register-email', { email, password });
  return response.data;
};

export const loginEmail = async (email, password) => {
  const response = await apiClient.post('/login-email', { email, password });
  return response.data;
};
