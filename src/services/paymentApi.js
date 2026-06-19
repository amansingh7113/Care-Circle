import axios from 'axios';
import { API_BASE_URL } from './apiConfig';
import { useStore } from '../store/useStore';

const getHeaders = () => {
  const token = useStore.getState().userSession;
  return {
    headers: { Authorization: `Bearer ${token}` }
  };
};

export const createPaymentOrder = async (amount) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/v1/payments/create-order`,
    { amount },
    getHeaders()
  );
  return response.data;
};

export const verifyPayment = async (paymentData) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/v1/payments/verify`,
    paymentData,
    getHeaders()
  );
  return response.data;
};
