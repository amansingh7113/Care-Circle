import { createApiClient } from './apiConfig';

const insightsApi = createApiClient('/api/v1/insights', { timeout: 20000 });

export const generateInsights = async (prescriptionId, forceRefresh = false, circleId = null) => {
  const response = await insightsApi.post('/generate-manual', {
    prescription_id: prescriptionId,
    force_refresh: forceRefresh,
    circle_id: circleId,
  });
  return response.data;
};

export const getDoctorSummary = async (circleId) => {
  const response = await insightsApi.get('/doctor-summary', {
    params: circleId ? { circle_id: circleId } : {}
  });
  return response.data; // { summary: "markdown..." }
};

export default { generateInsights, getDoctorSummary };
