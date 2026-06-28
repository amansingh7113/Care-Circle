const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const authenticate = require('../middleware/authenticate');
const { assertCircleMember, assertCircleRole } = require('../middleware/authorizer');
router.use(authenticate);

// POST /api/v1/doctor-visits
router.post('/', async (req, res) => {
  try {
    const { doctor_name, visit_date, reason, notes, attachment_urls, circle_id } = req.body;
    const targetCircleId = circle_id || req.user.circle_id;

    if (!targetCircleId) {
      return res.status(403).json({ error: 'Unauthorized: User is not part of any circle' });
    }

    try {
      assertCircleRole(req, targetCircleId, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized to add visits to this circle: Requires Admin or Caregiver role' });
    }

    const clean_attachment_urls = (attachment_urls || []).map(url => url.split('&token=')[0]);
    
    // Extract storage_path from first attachment url if present (CC-004)
    let storage_path = null;
    if (clean_attachment_urls.length > 0) {
      try {
        const urlObj = new URL(clean_attachment_urls[0]);
        storage_path = urlObj.searchParams.get('path');
      } catch (e) {}
    }

    const { data, error } = await supabase
      .from('doctor_visits')
      .insert([{ 
        doctor_name, 
        visit_date, 
        reason, 
        notes, 
        attachment_urls: clean_attachment_urls,
        storage_path,
        circle_id: targetCircleId
      }])
      .select();

    if (error) throw error;
    res.status(201).json({ data: data && data.length > 0 ? data[0] : null });
  } catch (err) {
    console.error('Add doctor visit error:', err);
    res.status(500).json({ error: 'Failed to add doctor visit.' });
  }
});

// GET /api/v1/doctor-visits
router.get('/', async (req, res) => {
  try {
    const circle_id = req.query.circle_id || req.user.circle_id;
    
    if (!circle_id) {
       return res.status(403).json({ error: 'User is not part of any circle' });
    }
    
    try {
      assertCircleMember(req, circle_id);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this circle' });
    }

    const { data, error } = await supabase
      .from('doctor_visits')
      .select('*')
      .eq('circle_id', circle_id)
      .order('visit_date', { ascending: false });

    if (error) throw error;

    res.status(200).json({ data: data || [] });
  } catch (err) {
    console.error('Get doctor visits error:', err);
    res.status(500).json({ error: 'Failed to get doctor visits.' });
  }
});

// DELETE /api/v1/doctor-visits/:id
router.delete('/:id', async (req, res) => {
  try {
    const visitId = req.params.id;

    const { data: visit, error: visitError } = await supabase
      .from('doctor_visits')
      .select('circle_id, attachment_urls, storage_path')
      .eq('id', visitId)
      .single();

    if (visitError || !visit) {
      return res.status(404).json({ error: 'Doctor visit not found' });
    }

    try {
      assertCircleRole(req, visit.circle_id, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to delete this visit: Requires Admin or Caregiver role' });
    }

    // Try to delete associated files from Supabase storage using server storage_path (CC-004)
    const storagePaths = [];
    if (visit.storage_path) {
      storagePaths.push(visit.storage_path);
    } else if (visit.attachment_urls && visit.attachment_urls.length > 0) {
      for (const url of visit.attachment_urls) {
        try {
          const urlObj = new URL(url);
          const filePath = urlObj.searchParams.get('path');
          if (filePath) storagePaths.push(filePath);
        } catch (parseErr) {
          console.warn('Failed to parse attachment url for deletion [REDACTED]');
        }
      }
    }

    if (storagePaths.length > 0) {
      await supabase.storage.from('documents').remove(storagePaths);
      console.log('Removed doctor visit attachments from storage [REDACTED]');
    }

    const { error } = await supabase
      .from('doctor_visits')
      .delete()
      .eq('id', visitId);

    if (error) throw error;
    res.status(200).json({ message: 'Doctor visit deleted successfully' });
  } catch (err) {
    console.error('Delete doctor visit error:', err);
    res.status(500).json({ error: 'Failed to delete doctor visit.' });
  }
});

// PATCH /api/v1/doctor-visits/:id
router.patch('/:id', async (req, res) => {
  try {
    const visitId = req.params.id;
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

    try {
      assertCircleRole(req, visit.circle_id, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to update this visit: Requires Admin or Caregiver role' });
    }

    const updateData = {};
    if (doctor_name !== undefined) updateData.doctor_name = doctor_name;
    if (visit_date !== undefined) updateData.visit_date = visit_date;
    if (reason !== undefined) updateData.reason = reason;
    if (notes !== undefined) updateData.notes = notes;
    if (attachment_urls !== undefined) {
      updateData.attachment_urls = (attachment_urls || []).map(url => url.split('&token=')[0]);
      if (updateData.attachment_urls.length > 0) {
        try {
          const urlObj = new URL(updateData.attachment_urls[0]);
          updateData.storage_path = urlObj.searchParams.get('path');
        } catch (e) {}
      }
    }

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
    res.status(500).json({ error: 'Failed to update doctor visit.' });
  }
});

module.exports = router;
