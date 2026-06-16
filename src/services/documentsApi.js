import { createApiClient } from './apiConfig';

const documentsApi = createApiClient('/api/v1/documents');

export const getDocuments = async (circleId) => {
  try {
    const response = await documentsApi.get(`/circle/${circleId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
};

export const addDocumentMetadata = async (documentData) => {
  try {
    const response = await documentsApi.post(`/`, documentData);
    return response.data;
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
};

export const deleteDocument = async (documentId) => {
  try {
    await documentsApi.delete(`/${documentId}`);
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

export const getUploadUrl = async (fileName, contentType) => {
  try {
    const response = await documentsApi.post('/upload-url', { fileName, contentType });
    return response.data;
  } catch (error) {
    console.error('Error getting upload URL:', error);
    throw error;
  }
};
