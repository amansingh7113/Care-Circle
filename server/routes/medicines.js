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

// 1. POST /api/v1/medicines
router.post('/', async (req, res) => {
  const { name, dosage, frequency, scheduled_times, circle_id } = req.body;
  const userCircleId = req.user.circle_id;
  const targetCircleId = circle_id || userCircleId;

  if (targetCircleId !== userCircleId) {
    return res.status(403).json({ error: 'Unauthorized to add medicine to this circle' });
  }

  if (!name || !dosage || !frequency || !scheduled_times) {
    return res.status(400).json({ error: 'Missing required fields: name, dosage, frequency, scheduled_times' });
  }

  const { data, error } = await supabase
    .from('medicines')
    .insert([
      { name, dosage, instructions: JSON.stringify({ frequency, scheduled_times }), circle_id: targetCircleId }
    ])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
});

// 2. GET /api/v1/circles/:circleId/medicines (Implemented here as well for convenience, but ideally mounted correctly in index.js)
router.get('/circles/:circleId/medicines', async (req, res) => {
  const { circleId } = req.params;
  const userCircleId = req.user.circle_id;

  if (circleId !== userCircleId) {
    return res.status(403).json({ error: 'Unauthorized access to this circle' });
  }

  const { data: medicines, error } = await supabase
    .from('medicines')
    .select('*')
    .eq('circle_id', circleId);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Fetch today's logs to determine status
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: logs, error: logsError } = await supabase
    .from('medicine_dose_logs')
    .select('*')
    .eq('circle_id', circleId)
    .gte('taken_at', todayStart.toISOString())
    .lte('taken_at', todayEnd.toISOString());

  const medicinesWithStatus = medicines.map(med => {
    const medLog = logs?.find(log => log.medicine_id === med.id);
    return {
      ...med,
      status: medLog ? medLog.status : 'pending'
    };
  });

  res.status(200).json(medicinesWithStatus);
});

// 3. POST /api/v1/medicines/:id/logs
router.post('/:id/logs', async (req, res) => {
  const medicine_id = req.params.id;
  const { status, taken_at } = req.body;
  const userCircleId = req.user.circle_id;
  const user_id = req.user.id;

  const { data: med, error: medError } = await supabase
    .from('medicines')
    .select('circle_id')
    .eq('id', medicine_id)
    .single();

  if (medError || !med) {
    return res.status(404).json({ error: 'Medicine not found' });
  }

  if (med.circle_id !== userCircleId) {
    return res.status(403).json({ error: 'Unauthorized access to this medicine' });
  }

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const { data, error } = await supabase
    .from('medicine_dose_logs')
    .insert([
      { 
        medicine_id, 
        circle_id: med.circle_id,
        status, 
        taken_at: taken_at || new Date().toISOString(),
        logged_by: user_id
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
});

// 4. GET /api/v1/medicines/:id/logs
router.get('/:id/logs', async (req, res) => {
  const medicine_id = req.params.id;
  const userCircleId = req.user.circle_id;

  const { data: med, error: medError } = await supabase
    .from('medicines')
    .select('circle_id')
    .eq('id', medicine_id)
    .single();

  if (medError || !med) {
    return res.status(404).json({ error: 'Medicine not found' });
  }

  if (med.circle_id !== userCircleId) {
    return res.status(403).json({ error: 'Unauthorized access to this medicine' });
  }

  const { data, error } = await supabase
    .from('medicine_dose_logs')
    .select('*')
    .eq('medicine_id', medicine_id)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data);
});

module.exports = router;
