const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authenticate = require('../middleware/authenticate');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

router.use(authenticate);

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, phone, email, role, circle_id')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.error('Fetch profile error:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    res.status(200).json({ user });
  } catch (err) {
    console.error('Fetch profile catch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { name, phone } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({ name, phone })
      .eq('id', req.user.id)
      .select('id, name, phone, email, role, circle_id')
      .single();

    if (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
    
    res.status(200).json(data);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/users/streak
router.get('/streak', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('current_streak')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.status(200).json({ streak: data.current_streak || 0 });
  } catch (err) {
    console.error('Get streak error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
