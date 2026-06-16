import { createApiClient } from './apiConfig';

const dashboardApi = createApiClient('');

export const getDashboardAggregated = async (circleId) => {
  const query = circleId ? `?circle_id=${circleId}` : '';
  const response = await dashboardApi.get(`/api/v1/dashboard${query}`);
  return response.data.data;
};

export default {
  getDashboardAggregated,
};
