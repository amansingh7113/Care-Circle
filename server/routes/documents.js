const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Authentication Middleware
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, phone_number, role, circle_id }

    // Fetch latest circle_id from DB to prevent stale token 403s
    const { data: dbUser } = await supabase.from('users').select('circle_id').eq('id', req.user.id).single();
    if (dbUser && dbUser.circle_id) {
      req.user.circle_id = dbUser.circle_id;
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

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
    res.json(data);
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

// Generate a signed upload URL
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
    // Generate a signed upload URL using the service role client
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
      .select('circle_id')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (String(doc.circle_id) !== String(userCircleId)) {
      return res.status(403).json({ error: 'Unauthorized to delete this document' });
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
