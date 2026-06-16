import { createApiClient, API_BASE_URL } from './apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const medicineApi = createApiClient('/api/v1/medicines');

export const getMedicines = async (circleId) => {
  const response = await medicineApi.get(`/circles/${circleId}/medicines`);
  return response.data;
};

export const addMedicine = async (circleId, data) => {
  const response = await medicineApi.post('/', { ...data, circle_id: circleId });
  return response.data;
};

export const logAdministration = async (medicineId, status, scheduledTime) => {
  const response = await medicineApi.post(`/${medicineId}/logs`, { status, scheduled_time: scheduledTime });
  return response.data;
};

export const getMedicineAnalytics = async () => {
  const response = await medicineApi.get(`/analytics/compliance`);
  return response.data;
};

export const deleteMedicine = async (medicineId) => {
  const response = await medicineApi.delete(`/${medicineId}`);
  return response.data;
};

export const archiveMedicine = async (medicineId) => {
  const response = await medicineApi.patch(`/${medicineId}/archive`);
  return response.data;
};

export const logVoiceMedicine = async (circleId, transcript) => {
  const response = await medicineApi.post('/voice-log', { circle_id: circleId, transcript });
  return response.data;
};

export const logVoiceMedicineAudio = async (circleId, audioUri) => {
  const formData = new FormData();
  formData.append('circle_id', circleId);
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a', // expo-av default on iOS/Android is often m4a or mp4
    name: 'voice-log.m4a',
  });
  
  const token = await AsyncStorage.getItem('userToken');
  const response = await fetch(`${API_BASE_URL}/api/v1/medicines/voice-log-audio`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    let errData;
    try { errData = await response.json(); } catch(e) {}
    throw new Error(errData?.error || 'Failed to process voice log');
  }
  
  return await response.json();
};

export const updateMedicine = async (medicineId, data) => {
  const response = await medicineApi.patch(`/${medicineId}`, data);
  return response.data;
};

export default {
  getMedicines,
  addMedicine,
  logAdministration,
  getMedicineAnalytics,
  deleteMedicine,
  archiveMedicine,
  logVoiceMedicine,
  logVoiceMedicineAudio,
  updateMedicine,
};
