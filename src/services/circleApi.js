import { createApiClient } from './apiConfig';

const circleApi = createApiClient('/api/v1/circles');

export const getUserCircles = async () => {
  const response = await circleApi.get('/');
  return response.data;
};

export const createCircle = async (name) => {
  const response = await circleApi.post('/', { name });
  return response.data;
};

export const joinCircle = async (inviteCode) => {
  const response = await circleApi.post('/join', { inviteCode });
  return response.data;
};

export const getCircleDetails = async (id) => {
  const response = await circleApi.get(`/${id}`);
  return response.data;
};

export default {
  getUserCircles,
  createCircle,
  joinCircle,
  getCircleDetails,
};
