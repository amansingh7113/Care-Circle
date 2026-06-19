import { createApiClient, API_BASE_URL } from './apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const uploadEncryptedFile = async (uri, name, mimeType) => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: uri,
      name: name || 'upload.jpg',
      type: mimeType || 'application/octet-stream',
    });

    const token = await AsyncStorage.getItem('userToken');
    const response = await fetch(`${API_BASE_URL}/api/v1/documents/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      let errData;
      try { errData = await response.json(); } catch (e) {}
      throw new Error(errData?.error || `Upload failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in uploadEncryptedFile:', error);
    throw error;
  }
};
