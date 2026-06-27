const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const authenticate = require('../middleware/authenticate');
router.use(authenticate);

// GET sleep logs for a circle
router.get('/:circleId', async (req, res) => {
  try {
    const { circleId } = req.params;
    if (String(circleId) !== String(req.user.circle_id)) {
      return res.status(403).json({ error: 'Unauthorized access to this circle sleep logs' });
    }
    
    const { data, error } = await supabase
      .from('sleep_logs')
      .select('*')
      .eq('circle_id', circleId)
      .order('logged_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching sleep logs:', error);
    res.status(500).json({ error: 'Failed to fetch sleep logs' });
  }
});

// POST new sleep log (Called by the App or Background Process)
router.post('/', async (req, res) => {
  try {
    const { circle_id, sleep_start, sleep_end, duration_minutes, is_auto_detected } = req.body;
    const patient_id = req.user.id;

    if (!circle_id || !sleep_start || !sleep_end) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (String(circle_id) !== String(req.user.circle_id)) {
      return res.status(403).json({ error: 'Unauthorized to add sleep logs to this circle' });
    }

    // Deduplication check
    const { data: existingLogs, error: checkError } = await supabase
      .from('sleep_logs')
      .select('*')
      .eq('patient_id', patient_id)
      .lt('sleep_start', sleep_end)
      .gt('sleep_end', sleep_start);

    if (checkError) {
      console.error('Error checking for sleep overlap:', checkError);
    } else if (existingLogs && existingLogs.length > 0) {
      return res.status(200).json({ data: existingLogs[0], deduplicated: true, message: 'Overlapping sleep log exists' });
    }

    const { data, error } = await supabase
      .from('sleep_logs')
      .insert([{
        circle_id,
        patient_id,
        sleep_start,
        sleep_end,
        duration_minutes,
        is_auto_detected
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error adding sleep log:', error);
    res.status(500).json({ error: 'Failed to add sleep log' });
  }
});

module.exports = router;
