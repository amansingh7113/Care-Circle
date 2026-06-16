import { createApiClient } from './apiConfig';

const doctorVisitApi = createApiClient('/api/v1/doctor-visits');

export const getDoctorVisits = async (circleId) => {
  const response = await doctorVisitApi.get('/', {
    params: circleId ? { circle_id: circleId } : {}
  });
  return response.data.data || [];
};

export const addDoctorVisit = async (visitData) => {
  const response = await doctorVisitApi.post('/', visitData);
  return response.data;
};

export const deleteDoctorVisit = async (visitId) => {
  const response = await doctorVisitApi.delete(`/${visitId}`);
  return response.data;
};

export const updateDoctorVisit = async (visitId, visitData) => {
  const response = await doctorVisitApi.patch(`/${visitId}`, visitData);
  return response.data;
};

export default {
  getDoctorVisits,
  addDoctorVisit,
  deleteDoctorVisit,
  updateDoctorVisit,
};
