const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const authenticate = require('../middleware/authenticate');

router.use(authenticate);

// Middleware to ensure user's circle_id is available
const ensureCircleId = async (req, res, next) => {
  if (req.user.circle_id) return next();
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('circle_id')
      .eq('id', req.user.id)
      .single();
    if (error || !user?.circle_id) {
      return res.status(403).json({ error: 'User does not belong to a circle' });
    }
    req.user.circle_id = user.circle_id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify circle membership' });
  }
};

router.use(ensureCircleId);

// GET / - Fetch notifications for user's circle
router.get('/', async (req, res) => {
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('circle_id', req.user.circle_id)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) throw error;
    
    // Get unread count
    const { count, error: countError } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', req.user.circle_id)
      .eq('is_read', false);
      
    if (countError) throw countError;

    res.json({ data: notifications, unread_count: count });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /:id/read - Mark single notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const { data: notif } = await supabaseAdmin
      .from('notifications')
      .select('circle_id')
      .eq('id', id)
      .single();
      
    if (!notif || notif.circle_id !== req.user.circle_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PATCH /read-all - Mark all notifications for the circle as read
router.patch('/read-all', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('circle_id', req.user.circle_id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// POST /push-token - Save push token
router.post('/push-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const { error } = await supabaseAdmin
      .from('users')
      .update({ push_token: token })
      .eq('id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Push token saved successfully' });
  } catch (err) {
    console.error('Error saving push token:', err);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

// POST /sos - Trigger an emergency alert
router.post('/sos', async (req, res) => {
  try {
    const circleId = req.user.circle_id;
    const patientName = req.user.name || 'A Patient';

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert([{
        circle_id: circleId,
        type: 'SOS',
        priority: 'high',
        title: `🚨 EMERGENCY: ${patientName}`,
        body: `${patientName} has triggered the SOS panic button. Immediate assistance required.`,
        context: { is_sos: true, triggered_by: req.user.id }
      }]);

    if (error) throw error;
    res.json({ message: 'SOS alert sent successfully' });
  } catch (err) {
    console.error('Error sending SOS:', err);
    res.status(500).json({ error: 'Failed to send SOS' });
  }
});

module.exports = router;
