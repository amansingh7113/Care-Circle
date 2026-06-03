const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
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
    res.status(201).json({ data: data[0] });
  } catch (err) {
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
    res.status(200).json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
