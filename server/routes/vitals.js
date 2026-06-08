const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const jwt = require('jsonwebtoken');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

// GET vitals for a circle
router.get('/:circleId', async (req, res) => {
  try {
    const { circleId } = req.params;
    
    const { data, error } = await supabase
      .from('BloodPressureLogs')
      .select('*')
      .eq('circle_id', circleId)
      .order('logged_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ error: 'Failed to fetch vitals' });
  }
});

// POST new blood pressure log
router.post('/', async (req, res) => {
  try {
    const { circle_id, systolic, diastolic, pulse, image_url } = req.body;
    const patient_id = req.user.id;

    const { data, error } = await supabase
      .from('BloodPressureLogs')
      .insert([{
        circle_id,
        patient_id,
        systolic,
        diastolic,
        pulse,
        image_url
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error adding vital log:', error);
    res.status(500).json({ error: 'Failed to add vital log' });
  }
});

module.exports = router;
