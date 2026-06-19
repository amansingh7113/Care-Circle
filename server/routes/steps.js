const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const authenticate = require('../middleware/authenticate');
router.use(authenticate);

// 1. Fetch step logs for a circle
router.get('/:circleId', async (req, res) => {
  const { circleId } = req.params;
  const requestedLimit = parseInt(req.query.limit, 10);
  const limit = (requestedLimit > 0 && requestedLimit <= 90) ? requestedLimit : 7;

  try {
    const { data: logs, error } = await supabase
      .from('step_logs')
      .select('*')
      .eq('circle_id', circleId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Fetch step logs error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(logs);
  } catch (err) {
    console.error('Fetch step logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Sync (upsert) step count for today
router.post('/', async (req, res) => {
  const { circle_id, date, step_count } = req.body;
  const patient_id = req.user.id;

  if (!circle_id || !date || step_count === undefined) {
    return res.status(400).json({ error: 'Missing required fields: circle_id, date, step_count' });
  }

  try {
    // Upsert the step count for the specific circle, patient, and date
    const { data: log, error } = await supabase
      .from('step_logs')
      .upsert(
        { circle_id, patient_id, date, step_count },
        { onConflict: 'circle_id, patient_id, date' }
      )
      .select()
      .single();

    if (error) {
      console.error('Sync step log error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(log);
  } catch (err) {
    console.error('Sync step log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
