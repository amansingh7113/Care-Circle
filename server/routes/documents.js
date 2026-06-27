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

const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, PDF, and TXT are allowed.'));
    }
  }
});

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function encrypt(buffer, keyString) {
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function decrypt(buffer, keyString) {
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedData = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

// 1. Decrypt endpoint (placed before router.use(authenticate) so it checks auth headers directly)
router.get('/decrypt', async (req, res) => {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  const filePath = req.query.path;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing token in Authorization header' });
  }
  if (!filePath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const pathCircleId = filePath.split('/')[0];
    let isAuthorized = false;

    if (String(pathCircleId) === String(decoded.circle_id)) {
      isAuthorized = true;
    }

    // Fetch all circle_ids for this user from DB to support multi-circle Caregivers/Patients
    if (!isAuthorized && decoded.id) {
      const { data: userRecords } = await supabase.from('circle_memberships').select('circle_id').eq('user_id', decoded.id).eq('status', 'active');
      if (userRecords && userRecords.length > 0) {
        const circleIds = userRecords.map(r => String(r.circle_id));
        if (circleIds.includes(String(pathCircleId))) {
          isAuthorized = true;
        }
      }
      // Fallback check on users table
      if (!isAuthorized) {
        const { data: uRecs } = await supabase.from('users').select('circle_id').eq('id', decoded.id);
        if (uRecs && uRecs.length > 0 && String(uRecs[0].circle_id) === String(pathCircleId)) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized to access this circle\'s files' });
    }

    // Download the file from Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (error || !data) {
      console.error('File download from storage failed [REDACTED]');
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
    else if (ext === 'txt') contentType = 'text/plain';

    res.setHeader('Content-Type', contentType);
    res.status(200).send(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed [REDACTED]');
    return res.status(401).json({ error: 'Unauthorized or invalid token' });
  }
});

const authenticate = require('../middleware/authenticate');
const { assertCircleMember } = require('../middleware/authorizer');
router.use(authenticate);

// Get all documents for a circle
router.get('/circle/:circleId', async (req, res) => {
  const { circleId } = req.params;

  try {
    assertCircleMember(req, circleId);
  } catch (authErr) {
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

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching documents [REDACTED]');
    res.status(500).json({ error: error.message });
  }
});

// Add a new document record
router.post('/', async (req, res) => {
  const { circle_id, title, category, file_url, visit_id } = req.body;
  const userCircleId = req.user.circle_id;
  const targetCircleId = circle_id || userCircleId;

  try {
    assertCircleMember(req, targetCircleId);
  } catch (authErr) {
    return res.status(403).json({ error: `Unauthorized: circle_id does not match user circle` });
  }

  // Extract storage_path from file_url if present
  let storage_path = null;
  if (file_url) {
    try {
      const urlObj = new URL(file_url);
      storage_path = urlObj.searchParams.get('path');
    } catch (e) {}
  }

  try {
    const { data, error } = await supabase
      .from('documents')
      .insert([
        { 
          circle_id: targetCircleId, 
          uploaded_by: req.user.id, // Force uploaded_by to prevent impersonation (CC-014)
          title, 
          category, 
          file_url, 
          storage_path, 
          visit_id: visit_id || null 
        }
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error adding document [REDACTED]');
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

    // Encrypt file buffer with AES-256-GCM
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
    console.error('Upload encryption failed [REDACTED]');
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

  if (!allowedMimeTypes.includes(contentType)) {
    return res.status(400).json({ error: 'Unsupported file type. Allowed: JPG, PNG, PDF, TXT.' });
  }

  const filePath = `${userCircleId}/${fileName}`;

  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUploadUrl(filePath);

    if (error) throw error;

    res.status(200).json({ signedUrl: data.signedUrl, token: data.token, filePath, maxFileSize: '10MB' });
  } catch (error) {
    console.error('Error generating upload URL [REDACTED]');
    res.status(500).json({ error: error.message });
  }
});

// Delete a document
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Verify document belongs to the user's circle before deleting
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('circle_id, file_url, storage_path')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    try {
      assertCircleMember(req, doc.circle_id);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized to delete this document' });
    }

    // Prefer server-stored storage_path over client URL parsing (CC-004)
    let filePath = doc.storage_path;
    if (!filePath && doc.file_url) {
      try {
        const urlParams = new URL(doc.file_url);
        filePath = urlParams.searchParams.get('path');
      } catch (parseErr) {
        console.warn('Failed to parse document file_url [REDACTED]');
      }
    }

    if (filePath) {
      await supabase.storage.from('documents').remove([filePath]);
      console.log('Removed document file from storage [REDACTED]');
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting document [REDACTED]');
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
