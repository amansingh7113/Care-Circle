const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authenticate = require('../middleware/authenticate');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

router.use(authenticate);

// GET /api/v1/hydration - Get today's total hydration
router.get('/', async (req, res) => {
  try {
    const circleId = req.user.circle_id;
    if (!circleId) return res.status(400).json({ error: 'User does not belong to a circle' });

    const todayStr = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('hydration_logs')
      .select('amount_ml')
      .eq('circle_id', circleId)
      .eq('date', todayStr);

    if (error) throw error;

    const total_ml = data.reduce((sum, log) => sum + log.amount_ml, 0);

    res.status(200).json({ total_ml });
  } catch (error) {
    console.error('Error fetching hydration:', error);
    res.status(500).json({ error: 'Failed to fetch hydration logs' });
  }
});

// POST /api/v1/hydration - Log water intake
router.post('/', async (req, res) => {
  try {
    const circleId = req.user.circle_id;
    if (!circleId) return res.status(400).json({ error: 'User does not belong to a circle' });

    const { amount_ml } = req.body;
    if (!amount_ml || typeof amount_ml !== 'number') {
      return res.status(400).json({ error: 'amount_ml is required and must be a number' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('hydration_logs')
      .insert([{
        circle_id: circleId,
        logged_by: req.user.id,
        amount_ml: amount_ml,
        date: todayStr
      }]);

    if (error) throw error;

    // Fetch new total
    const { data: newData, error: newError } = await supabase
      .from('hydration_logs')
      .select('amount_ml')
      .eq('circle_id', circleId)
      .eq('date', todayStr);

    if (newError) throw newError;

    const total_ml = newData.reduce((sum, log) => sum + log.amount_ml, 0);

    res.status(201).json({ total_ml, message: 'Hydration logged successfully' });
  } catch (error) {
    console.error('Error logging hydration:', error);
    res.status(500).json({ error: 'Failed to log hydration' });
  }
});

module.exports = router;
