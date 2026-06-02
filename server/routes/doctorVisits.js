const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// POST /api/v1/doctor-visits
router.post('/', async (req, res) => {
  try {
    const { doctor_name, visit_date, reason, notes, attachment_urls, circle_id } = req.body;
    
    // Extract JWT from Auth header
    const token = req.headers.authorization?.split(' ')[1];
    
    // Create Supabase client using the user's JWT to leverage RLS
    const userSupabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder_key', {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data, error } = await userSupabase
      .from('doctor_visits')
      .insert([{ 
        doctor_name, 
        visit_date, 
        reason, 
        notes, 
        attachment_urls,
        circle_id: circle_id || req.user?.circle_id // fallback if provided by middleware
      }])
      .select();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/doctor-visits
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    const userSupabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder_key', {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const circle_id = req.query.circle_id || req.user?.circle_id;
    let query = userSupabase
      .from('doctor_visits')
      .select('*')
      .order('visit_date', { ascending: false });
      
    // Optionally filter by circle_id if needed, though RLS will also restrict to user's circle
    if (circle_id) {
        query = query.eq('circle_id', circle_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
