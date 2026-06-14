const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Get all documents for a circle
router.get('/circle/:circleId', async (req, res) => {
  const { circleId } = req.params;
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
  try {
    const { data, error } = await supabase
      .from('documents')
      .insert([
        { circle_id, uploaded_by, title, category, file_url, visit_id: visit_id || null }
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

// Delete a document
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
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
