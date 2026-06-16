import { createApiClient } from './apiConfig';

const sleepApi = createApiClient('/api/v1/sleep');

export const getSleepLogs = async (circleId) => {
  const response = await sleepApi.get(`/${circleId}`);
  return response.data;
};

// In our automatic architecture, this is primarily called by the background service directly 
// to the backend, but we keep it here in case we need a manual override option.
export const addSleepLog = async (data) => {
  const response = await sleepApi.post('/', data);
  return response.data;
};

export default {
  getSleepLogs,
  addSleepLog,
};
