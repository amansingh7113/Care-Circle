import { createApiClient } from './apiConfig';

const hydrationApi = createApiClient('/api/v1/hydration');

export const getTodayHydration = async () => {
  const response = await hydrationApi.get('/');
  return response.data; // { total_ml: number }
};

export const logHydration = async (amountMl) => {
  const response = await hydrationApi.post('/', { amount_ml: amountMl });
  return response.data; // { total_ml: number, message: string }
};

export default { getTodayHydration, logHydration };
