import axios from 'axios';
import { API_BASE_URL } from './apiConfig';
import { useStore } from '../store/useStore';

export const fetchExportData = async (months) => {
  try {
    const token = useStore.getState().userSession;
    if (!token) throw new Error('No auth token');

    const response = await axios.get(`${API_BASE_URL}/api/v1/export/report?months=${months}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data.data;
  } catch (error) {
    console.error('Error fetching export data:', error);
    throw error;
  }
};
