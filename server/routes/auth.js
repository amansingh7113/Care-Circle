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

// 5. Delete Account (Hard Delete)
router.delete('/delete-account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
    
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    if (!userId) return res.status(401).json({ error: 'Invalid token payload' });

    // Ensure we use the service_role key to bypass RLS and delete from auth.users
    const adminSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Hard delete user using Admin API (this cascades depending on DB foreign key setup)
    const { data, error } = await adminSupabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error('Delete user error:', error);
      return res.status(500).json({ error: 'Failed to delete user account.' });
    }

    res.status(200).json({ success: true, message: 'Account permanently deleted' });
  } catch (err) {
    console.error('Delete account catch error:', err);
    res.status(500).json({ error: 'Internal server error during account deletion' });
  }
});

// 6. Register with Email/Password
router.post('/register-email', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    // Register with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: 'Failed to create user.' });
    }

    // Check if user is in users table, or provision basic profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Error fetching user profile after sign up' });
    }

    let profile = userProfile;
    if (!profile) {
      // Provision user
      profile = {
        id: authData.user.id,
        phone_number: null,
        profile_role: 'User',
        circle_id: null
      };
      
      // Attempt to insert if DB triggers don't handle it
      await supabase.from('users').insert(profile).select().single();
    }

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

// 7. Login with Email/Password
router.post('/login-email', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(401).json({ error: authError.message });
    }

    // Fetch user profile from public.users table
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
      phone_number: null, 
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

module.exports = router;
