const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co', 
  process.env.SUPABASE_ANON_KEY || 'placeholder_key'
);

router.post('/create', async (req, res) => {
  const { user_id, circle_name } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  // Insert new circle
  const { data: circle, error: circleError } = await supabase
    .from('circles')
    .insert([{ name: circle_name || 'My Care Circle' }])
    .select()
    .single();

  if (circleError) {
    return res.status(500).json({ error: circleError.message });
  }

  // Update creating user's role to 'Admin' and link circle_id
  const { error: userError } = await supabase
    .from('users')
    .update({ profile_role: 'Admin', circle_id: circle.id })
    .eq('id', user_id);

  if (userError) {
    return res.status(500).json({ error: userError.message });
  }

  const deepLink = `https://carecircle.app/join?id=${circle.id}`;

  res.status(200).json({
    message: 'Circle created successfully',
    circle,
    invite_link: deepLink
  });
});

module.exports = router;
