const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const authenticate = require('../middleware/authenticate');
const { assertCircleMember } = require('../middleware/authorizer');
router.use(authenticate);

// 1. Fetch step logs for a circle
router.get('/:circleId', async (req, res) => {
  const { circleId } = req.params;
  try {
    assertCircleMember(req, circleId);
  } catch (authErr) {
    return res.status(403).json({ error: 'Unauthorized access to this circle step logs' });
  }
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
      return res.status(500).json({ error: 'Failed to fetch step logs.' });
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
    assertCircleMember(req, circle_id);
  } catch (authErr) {
    return res.status(403).json({ error: 'Unauthorized to add step logs to this circle' });
  }

  try {
    // Check if a record already exists for this circle_id and date
    const { data: existing, error: findError } = await supabase
      .from('step_logs')
      .select('*')
      .eq('circle_id', circle_id)
      .eq('date', date)
      .limit(1);

    if (findError) {
      console.error('Find step log error:', findError);
      return res.status(500).json({ error: 'Failed to find step log.' });
    }

    if (existing && existing.length > 0) {
      // Update existing record
      const { data: log, error: updateError } = await supabase
        .from('step_logs')
        .update({ step_count })
        .eq('id', existing[0].id)
        .select()
        .single();

      if (updateError) {
        console.error('Update step log error:', updateError);
        return res.status(500).json({ error: 'Failed to update step log.' });
      }
      return res.status(200).json(log);
    } else {
      // Insert new record
      const { data: log, error: insertError } = await supabase
        .from('step_logs')
        .insert([{ circle_id, patient_id, date, step_count }])
        .select()
        .single();

      if (insertError) {
        console.error('Insert step log error:', insertError);
        return res.status(500).json({ error: 'Failed to insert step log.' });
      }
      return res.status(200).json(log);
    }
  } catch (err) {
    console.error('Sync step log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
