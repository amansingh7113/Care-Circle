const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co', 
  process.env.SUPABASE_ANON_KEY || 'placeholder_key'
);

router.post('/send-otp', async (req, res) => {
  const { phone_number } = req.body;
  
  if (!phone_number) {
    return res.status(400).json({ error: 'phone_number is required' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone_number', phone_number)
    .single();

  // Stub SMS dispatch
  console.log(`[SMS Gateway ${process.env.SMS_GATEWAY_URL || 'default'}] Dispatching OTP to ${phone_number}`);

  res.status(200).json({ success: true, verification_id: 'mock-verification-id-123' });
});

router.post('/verify-otp', async (req, res) => {
  const { phone_number, otp, verification_id } = req.body;

  if (otp === '123456') {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, phone_number, profile_role, circle_id')
      .eq('phone_number', phone_number)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      token: 'mock-jwt-token',
      user: {
        id: user.id,
        phone_number: user.phone_number,
        profile_role: user.profile_role,
        circle_id: user.circle_id
      }
    });
  }

  res.status(401).json({ error: 'Invalid OTP' });
});

module.exports = router;
