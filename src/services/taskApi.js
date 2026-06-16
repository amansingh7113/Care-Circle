import { createApiClient } from './apiConfig';

const taskApi = createApiClient('/api/v1/tasks');

export const getTasks = async (circleId, status = '') => {
  const query = status ? `?status=${status}` : '';
  const response = await taskApi.get(`/circles/${circleId}/tasks${query}`);
  return response.data;
};

export const createTask = async (circleId, taskData) => {
  const response = await taskApi.post('/', { ...taskData, circle_id: circleId });
  return response.data;
};

export const updateTaskStatus = async (taskId, updateData) => {
  const response = await taskApi.patch(`/${taskId}`, updateData);
  return response.data;
};

export const updateTask = async (taskId, updateData) => {
  const response = await taskApi.patch(`/${taskId}`, updateData);
  return response.data;
};

export const deleteTask = async (taskId) => {
  const response = await taskApi.delete(`/${taskId}`);
  return response.data;
};

export const getTaskComments = async (taskId) => {
  const response = await taskApi.get(`/${taskId}/comments`);
  return response.data;
};

export const addTaskComment = async (taskId, content) => {
  const response = await taskApi.post(`/${taskId}/comments`, { comment: content });
  return response.data;
};

export default {
  getTasks,
  createTask,
  updateTaskStatus,
  updateTask,
  deleteTask,
  getTaskComments,
  addTaskComment,
};
