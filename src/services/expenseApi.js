import { createApiClient } from './apiConfig';

const expenseApi = createApiClient('/api/v1/expenses');

export const getExpensesSummary = async () => {
  const response = await expenseApi.get('/summary');
  return response.data;
};

export const addExpense = async (expenseData) => {
  const response = await expenseApi.post('/', expenseData);
  return response.data;
};

export const deleteExpense = async (expenseId) => {
  const response = await expenseApi.delete(`/${expenseId}`);
  return response.data;
};

export const updateExpense = async (expenseId, expenseData) => {
  const response = await expenseApi.patch(`/${expenseId}`, expenseData);
  return response.data;
};

export const updateBudget = async (monthlyLimit) => {
  const response = await expenseApi.put('/budget', { monthly_limit: monthlyLimit });
  return response.data;
};

export default {
  getExpensesSummary,
  addExpense,
  deleteExpense,
  updateExpense,
  updateBudget,
};
