const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const upload = multer({ storage: multer.memoryStorage() });

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

function encrypt(buffer, keyString) {
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decrypt(buffer, keyString) {
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = buffer.subarray(0, IV_LENGTH);
  const encryptedData = buffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

// 1. Decrypt endpoint (placed before router.use(authenticate) so it bypasses auth headers requirement)
router.get('/decrypt', async (req, res) => {
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  const filePath = req.query.path;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }
  if (!filePath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify circle_id in the path matches user's circle_id (isolation security check)
    const pathCircleId = filePath.split('/')[0];
    if (String(pathCircleId) !== String(decoded.circle_id)) {
      return res.status(403).json({ error: 'Unauthorized to access this circle\'s files' });
    }

    // Download the file from Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (error || !data) {
      console.error('File download from storage failed:', error);
      return res.status(404).json({ error: 'File not found' });
    }

    const encryptedBuffer = Buffer.from(await data.arrayBuffer());
    const decryptedBuffer = decrypt(encryptedBuffer, process.env.ENCRYPTION_KEY || process.env.JWT_SECRET);

    // Set correct Content-Type header
    const ext = filePath.split('.').pop().toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'pdf') contentType = 'application/pdf';

    res.setHeader('Content-Type', contentType);
    res.status(200).send(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed:', err);
    return res.status(401).json({ error: 'Unauthorized or invalid token' });
  }
});

const authenticate = require('../middleware/authenticate');
router.use(authenticate);

// Get all documents for a circle
router.get('/circle/:circleId', async (req, res) => {
  const { circleId } = req.params;
  const userCircleId = req.user.circle_id;

  if (String(circleId) !== String(userCircleId)) {
    return res.status(403).json({ error: 'Unauthorized access to this circle' });
  }

  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        uploader:uploaded_by(name),
        doctor_visit:visit_id(doctor_name, visit_date)
      `)
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Dynamically append authorization token to file_url for decryption
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : '';

    const formattedData = (data || []).map(doc => {
      let fileUrl = doc.file_url;
      if (fileUrl && fileUrl.includes('/decrypt') && token) {
        fileUrl = `${fileUrl}&token=${token}`;
      }
      return { ...doc, file_url: fileUrl };
    });

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new document record
router.post('/', async (req, res) => {
  const { circle_id, uploaded_by, title, category, file_url, visit_id } = req.body;
  const userCircleId = req.user.circle_id;

  if (circle_id && userCircleId && String(circle_id) !== String(userCircleId)) {
    return res.status(403).json({ error: `Unauthorized: circle_id ${circle_id} does not match user circle ${userCircleId}` });
  }

  try {
    const { data, error } = await supabase
      .from('documents')
      .insert([
        { circle_id: circle_id || userCircleId, uploaded_by, title, category, file_url, visit_id: visit_id || null }
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error adding document:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/documents/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const userCircleId = req.user.circle_id;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  if (!userCircleId) {
    return res.status(403).json({ error: 'User does not belong to a circle' });
  }

  try {
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userCircleId}/${fileName}`;

    // Encrypt file buffer
    const encryptedBuffer = encrypt(file.buffer, process.env.ENCRYPTION_KEY || process.env.JWT_SECRET);

    // Upload encrypted buffer to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, encryptedBuffer, {
        contentType: file.mimetype || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Generate decryption URL dynamically using host
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const decryptionUrl = `${baseUrl}/api/v1/documents/decrypt?path=${filePath}`;

    res.status(201).json({
      message: 'File uploaded and encrypted successfully',
      url: decryptionUrl,
      filePath
    });
  } catch (err) {
    console.error('Upload encryption failed:', err);
    res.status(500).json({ error: err.message || 'Failed to upload and encrypt file' });
  }
});

// Generate a signed upload URL (Deprecated, but kept for legacy/backwards compatibility)
router.post('/upload-url', async (req, res) => {
  const { fileName, contentType } = req.body;
  const userCircleId = req.user.circle_id;

  if (!fileName || !userCircleId || !contentType) {
    return res.status(400).json({ error: 'Missing fileName, contentType, or circle_id' });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(contentType)) {
    return res.status(400).json({ error: 'Unsupported file type. Allowed: JPG, PNG, PDF.' });
  }

  const filePath = `${userCircleId}/${fileName}`;

  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    res.status(200).json({ signedUrl: data.signedUrl, token: data.token, filePath, maxFileSize: '10MB' });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a document
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userCircleId = req.user.circle_id;

  try {
    // Verify document belongs to the user's circle before deleting
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('circle_id, file_url')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (String(doc.circle_id) !== String(userCircleId)) {
      return res.status(403).json({ error: 'Unauthorized to delete this document' });
    }

    // Try to delete the file from Supabase storage first
    if (doc.file_url) {
      try {
        const urlParams = new URL(doc.file_url);
        const filePath = urlParams.searchParams.get('path');
        if (filePath) {
          await supabase.storage.from('documents').remove([filePath]);
          console.log('Removed document file from storage:', filePath);
        }
      } catch (parseErr) {
        console.warn('Failed to parse and remove document file from storage:', parseErr.message);
      }
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
