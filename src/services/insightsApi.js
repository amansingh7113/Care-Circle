import { createApiClient } from './apiConfig';

const insightsApi = createApiClient('/api/v1/insights', { timeout: 20000 });

export const generateInsights = async (prescriptionId, forceRefresh = false) => {
  const response = await insightsApi.post('/generate-manual', {
    prescription_id: prescriptionId,
    force_refresh: forceRefresh,
  });
  return response.data;
};

export const getDoctorSummary = async () => {
  const response = await insightsApi.get('/doctor-summary');
  return response.data; // { summary: "markdown..." }
};

export default { generateInsights, getDoctorSummary };
