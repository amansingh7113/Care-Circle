import { createApiClient } from './apiConfig';

const stepApi = createApiClient('/api/v1/steps');

export const getSteps = async (circleId, limit) => {
  const query = limit ? `?limit=${limit}` : '';
  const response = await stepApi.get(`/${circleId}${query}`);
  return response.data;
};

export const syncSteps = async (circleId, date, stepCount) => {
  const response = await stepApi.post('/', {
    circle_id: circleId,
    date,
    step_count: stepCount
  });
  return response.data;
};

export default {
  getSteps,
  syncSteps,
};
