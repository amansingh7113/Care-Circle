import { API_BASE_URL } from './apiConfig';

export const getDocuments = async (circleId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/documents/circle/${circleId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
};

export const addDocumentMetadata = async (documentData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(documentData),
    });
    if (!response.ok) {
      throw new Error('Failed to add document metadata');
    }
    return await response.json();
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
};

export const deleteDocument = async (documentId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/documents/${documentId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete document');
    }
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};
