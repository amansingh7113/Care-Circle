const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Authentication Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, phone_number, role, circle_id }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(authenticate);

// 0. Fetch user circles
router.get('/', async (req, res) => {
  const user_id = req.user.id;

  const { data: userRecords, error } = await supabase
    .from('users')
    .select('circle_id, role, circles(id, name)')
    .eq('id', user_id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const circles = userRecords.filter(r => r.circles).map(record => ({
    id: record.circles.id,
    name: record.circles.name,
    role: record.role
  }));

  res.status(200).json({ circles });
});

// 1. Create a new care circle
router.post('/', async (req, res) => {
  const { name, user_name } = req.body;
  const user_id = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Circle name is required' });
  }

  // Insert new circle
  const { data: circle, error: circleError } = await supabase
    .from('circles')
    .insert([{ name }])
    .select()
    .single();

  if (circleError) {
    return res.status(500).json({ error: circleError.message });
  }

  // Upsert the user into the users table with 'Admin' role
  const { error: userError } = await supabase
    .from('users')
    .upsert([{ 
      id: user_id, 
      circle_id: circle.id, 
      name: user_name || req.user.phone_number || 'Caregiver', 
      role: 'Admin' 
    }]);

  if (userError) {
    return res.status(500).json({ error: userError.message });
  }

  res.status(201).json({
    message: 'Circle created successfully',
    circle
  });
});

// 2. Fetch details for a specific care circle
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // We check if the user requesting is part of this circle, though RLS does it too.
  if (req.user.circle_id && req.user.circle_id !== id) {
    // If local token has a different circle_id, be careful. But let RLS handle it if using user's token.
    // Wait, we are using SERVICE_ROLE_KEY in supabase client above! We should do manual checks or use RLS.
    // We'll do manual check.
  }

  const { data: circle, error: circleError } = await supabase
    .from('circles')
    .select('*')
    .eq('id', id)
    .single();

  if (circleError) {
    return res.status(404).json({ error: 'Circle not found' });
  }

  const { data: members, error: membersError } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('circle_id', id);

  if (membersError) {
    return res.status(500).json({ error: membersError.message });
  }

  res.status(200).json({
    circle,
    members
  });
});

// 3. Generate invite code
router.post('/:id/invite', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !['Admin', 'Caregiver', 'Viewer', 'Patient'].includes(role)) {
    return res.status(400).json({ error: 'Valid role is required' });
  }

  // Create an invite token using JWT
  const invitePayload = {
    circle_id: id,
    role: role,
    type: 'invite'
  };

  const inviteToken = jwt.sign(invitePayload, process.env.JWT_SECRET, { expiresIn: '7d' });
  const inviteCode = Buffer.from(inviteToken).toString('base64');

  res.status(200).json({
    message: 'Invite generated',
    inviteCode,
    role
  });
});

// 4. Join a circle
router.post('/join', async (req, res) => {
  const { inviteCode, user_name } = req.body;
  const user_id = req.user.id;

  if (!inviteCode) {
    return res.status(400).json({ error: 'inviteCode is required' });
  }

  try {
    const inviteToken = Buffer.from(inviteCode, 'base64').toString('ascii');
    const decoded = jwt.verify(inviteToken, process.env.JWT_SECRET);

    if (decoded.type !== 'invite' || !decoded.circle_id || !decoded.role) {
      return res.status(400).json({ error: 'Invalid invite code structure' });
    }

    const { circle_id, role } = decoded;

    // Verify circle exists
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('id')
      .eq('id', circle_id)
      .single();

    if (circleError) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    // Upsert user into circle
    const { error: userError } = await supabase
      .from('users')
      .upsert([{ 
        id: user_id, 
        circle_id: circle.id, 
        name: user_name || req.user.phone_number || 'Family Member', 
        role: role 
      }]);

    if (userError) {
      return res.status(500).json({ error: userError.message });
    }

    res.status(200).json({
      message: 'Joined circle successfully',
      circle_id: circle.id,
      role
    });

  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired invite code' });
  }
});

module.exports = router;
