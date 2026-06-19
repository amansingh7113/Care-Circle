import { createApiClient, API_BASE_URL } from './apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const nutritionApi = createApiClient('/api/v1/nutrition');

export const scanMeal = async (imageUri) => {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'meal.jpg',
  });
  
  const token = await AsyncStorage.getItem('userToken');
  const response = await fetch(`${API_BASE_URL}/api/v1/nutrition/scan`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    let errData;
    try { errData = await response.json(); } catch(e) {}
    throw new Error(errData?.error || 'Failed to scan meal');
  }
  
  return await response.json();
};

export const logNutrition = async (data) => {
  const response = await nutritionApi.post('/', data);
  return response.data;
};

export const getTodayNutrition = async () => {
  const response = await nutritionApi.get('/');
  return response.data;
};

export default {
  scanMeal,
  logNutrition,
  getTodayNutrition,
};
