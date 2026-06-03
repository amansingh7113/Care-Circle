const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// 1. Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { phone_number } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({ error: 'phone_number is required' });
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone_number,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ success: true, message: 'OTP sent successfully', data });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone_number, token } = req.body;

    if (!phone_number || !token) {
      return res.status(400).json({ error: 'phone_number and token are required' });
    }

    const { data: authData, error: authError } = await supabase.auth.verifyOtp({
      phone: phone_number,
      token: token,
      type: 'sms',
    });

    if (authError) {
      return res.status(401).json({ error: authError.message });
    }

    // Fetch user profile from public.users table or similar to get role and circle status
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Error fetching user profile' });
    }
    
    // Fallback if user profile not fully formed yet
    const profile = userProfile || { 
      id: authData.user.id, 
      phone_number: authData.user.phone, 
      profile_role: 'User', 
      circle_id: null 
    };

    // Sign a local JWT
    const jwtPayload = {
      id: profile.id,
      phone_number: profile.phone_number,
      role: profile.profile_role,
      circle_id: profile.circle_id
    };

    const localJwt = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token: localJwt,
      user: profile,
      session: authData.session
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Google OAuth Helper
router.get('/google', async (req, res) => {
  try {
    const redirectUri = req.query.redirectUri || 'carecircle://auth/callback';
    
    // Generate the Google OAuth URL
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ url: data.url });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Exchange Supabase Session for Local JWT
router.post('/exchange-session', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'access_token is required' });

    // Verify Supabase token
    const { data: { user }, error } = await supabase.auth.getUser(access_token);
    if (error || !user) {
      return res.status(401).json({ error: error?.message || 'Invalid token' });
    }

    // Fetch user profile from public.users table or similar to get role and circle status
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Error fetching user profile' });
    }
    
    // Fallback if user profile not fully formed yet
    const profile = userProfile || { 
      id: user.id, 
      phone_number: user.phone, 
      profile_role: 'User', 
      circle_id: null 
    };

    // Sign a local JWT
    const jwtPayload = {
      id: profile.id,
      phone_number: profile.phone_number,
      role: profile.profile_role,
      circle_id: profile.circle_id
    };

    const localJwt = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      token: localJwt,
      user: profile
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
