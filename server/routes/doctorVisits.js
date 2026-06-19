const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const authenticate = require('../middleware/authenticate');
router.use(authenticate);

// POST /api/v1/doctor-visits
router.post('/', async (req, res) => {
  try {
    const { doctor_name, visit_date, reason, notes, attachment_urls, circle_id } = req.body;
    const targetCircleId = circle_id || req.user.circle_id;

    if (!targetCircleId) {
      return res.status(403).json({ error: 'Unauthorized: User is not part of any circle' });
    }
    if (circle_id && circle_id !== req.user.circle_id) {
      return res.status(403).json({ error: 'Unauthorized to add visits to this circle' });
    }

    const { data, error } = await supabase
      .from('doctor_visits')
      .insert([{ 
        doctor_name, 
        visit_date, 
        reason, 
        notes, 
        attachment_urls,
        circle_id: targetCircleId
      }])
      .select();

    if (error) throw error;
    res.status(201).json({ data: data && data.length > 0 ? data[0] : null });
  } catch (err) {
    console.error('Add doctor visit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/doctor-visits
router.get('/', async (req, res) => {
  try {
    const circle_id = req.query.circle_id || req.user.circle_id;
    
    if (!circle_id) {
       return res.status(403).json({ error: 'User is not part of any circle' });
    }
    
    if (req.query.circle_id && req.query.circle_id !== req.user.circle_id) {
        return res.status(403).json({ error: 'Unauthorized access to this circle' });
    }

    const { data, error } = await supabase
      .from('doctor_visits')
      .select('*')
      .eq('circle_id', circle_id)
      .order('visit_date', { ascending: false });

    if (error) throw error;

    // Dynamically append authorization token to attachment_urls for decryption
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : '';

    const formattedData = (data || []).map(visit => {
      const urls = (visit.attachment_urls || []).map(url => {
        if (url && url.includes('/decrypt') && token) {
          return `${url}&token=${token}`;
        }
        return url;
      });
      return { ...visit, attachment_urls: urls };
    });

    res.status(200).json({ data: formattedData });
  } catch (err) {
    console.error('Get doctor visits error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/doctor-visits/:id
router.delete('/:id', async (req, res) => {
  try {
    const visitId = req.params.id;
    const userCircleId = req.user.circle_id;

    const { data: visit, error: visitError } = await supabase
      .from('doctor_visits')
      .select('circle_id')
      .eq('id', visitId)
      .single();

    if (visitError || !visit) {
      return res.status(404).json({ error: 'Doctor visit not found' });
    }

    if (String(visit.circle_id) !== String(userCircleId)) {
      return res.status(403).json({ error: 'Unauthorized access to this visit' });
    }

    const { error } = await supabase
      .from('doctor_visits')
      .delete()
      .eq('id', visitId);

    if (error) throw error;
    res.status(200).json({ message: 'Doctor visit deleted successfully' });
  } catch (err) {
    console.error('Delete doctor visit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/doctor-visits/:id
router.patch('/:id', async (req, res) => {
  try {
    const visitId = req.params.id;
    const userCircleId = req.user.circle_id;
    const { doctor_name, visit_date, reason, notes, attachment_urls } = req.body;

    // Verify visit belongs to the user's circle
    const { data: visit, error: visitError } = await supabase
      .from('doctor_visits')
      .select('circle_id')
      .eq('id', visitId)
      .single();

    if (visitError || !visit) {
      return res.status(404).json({ error: 'Doctor visit not found' });
    }

    if (String(visit.circle_id) !== String(userCircleId)) {
      return res.status(403).json({ error: 'Unauthorized access to this visit' });
    }

    const updateData = {};
    if (doctor_name !== undefined) updateData.doctor_name = doctor_name;
    if (visit_date !== undefined) updateData.visit_date = visit_date;
    if (reason !== undefined) updateData.reason = reason;
    if (notes !== undefined) updateData.notes = notes;
    if (attachment_urls !== undefined) updateData.attachment_urls = attachment_urls;

    const { data, error } = await supabase
      .from('doctor_visits')
      .update(updateData)
      .eq('id', visitId)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('Update doctor visit error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
