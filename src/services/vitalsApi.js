import { createApiClient } from './apiConfig';

const vitalsApi = createApiClient('/api/v1/vitals');

export const getVitals = async (circleId) => {
  const response = await vitalsApi.get(`/${circleId}`);
  return response.data;
};

export const logVitals = async (data) => {
  const response = await vitalsApi.post('/', data);
  return response.data;
};

export const updateVitals = async (id, data) => {
  const response = await vitalsApi.put(`/${id}`, data);
  return response.data;
};

export const deleteVitals = async (id) => {
  const response = await vitalsApi.delete(`/${id}`);
  return response.data;
};

export default {
  getVitals,
  logVitals,
  updateVitals,
  deleteVitals,
};
