import { createApiClient } from './apiConfig';

const notificationApi = createApiClient('/api/v1/notifications');

export const getNotifications = async () => {
  const response = await notificationApi.get('/');
  return response.data;
};

export const markAsRead = async (notificationId) => {
  const response = await notificationApi.patch(`/${notificationId}/read`);
  return response.data;
};

export const markAllAsRead = async () => {
  const response = await notificationApi.patch('/read-all');
  return response.data;
};

export const savePushToken = async (token) => {
  const response = await notificationApi.post('/push-token', { token });
  return response.data;
};

export default { getNotifications, markAsRead, markAllAsRead, savePushToken };
