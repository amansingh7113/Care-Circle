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
  const { name, dosage, frequency, scheduled_times, days, circle_id, stock_quantity, refill_alert_threshold } = req.body;
  const userCircleId = req.user.circle_id;
  const targetCircleId = circle_id || userCircleId;

  if (String(targetCircleId) !== String(userCircleId)) {
    return res.status(403).json({ error: 'Unauthorized to add medicine to this circle' });
  }

  if (!name || !dosage || !frequency) {
    return res.status(400).json({ error: 'Missing required fields: name, dosage, frequency' });
  }

  if (typeof name !== 'string' || typeof dosage !== 'string' || typeof frequency !== 'string') {
    return res.status(400).json({ error: 'Invalid data types: name, dosage, and frequency must be strings' });
  }

  if (scheduled_times && !Array.isArray(scheduled_times)) {
    return res.status(400).json({ error: 'scheduled_times must be an array of strings' });
  }

  if (days && !Array.isArray(days)) {
    return res.status(400).json({ error: 'days must be an array of strings' });
  }

  const instructions = { frequency, scheduled_times: scheduled_times || [], days: days || [] };

  const { data, error } = await supabase
    .from('medicines')
    .insert([
      { name, dosage, instructions, circle_id: targetCircleId, stock_quantity, refill_alert_threshold }
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

  if (String(circleId) !== String(userCircleId)) {
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

  // Fetch users for attribution
  const userIds = [...new Set(logs?.map(l => l.logged_by).filter(Boolean) || [])];
  let usersMap = {};
  if (userIds.length > 0) {
    const { data: usersData } = await supabase.from('users').select('id, full_name').in('id', userIds);
    usersData?.forEach(u => { usersMap[u.id] = u.full_name || 'Family Member'; });
  }

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayName = daysOfWeek[todayStart.getDay()];

  const flattenedMedicines = [];

  medicines.forEach(med => {
    let instructions = {};
    try {
      let parsed = typeof med.instructions === 'string' ? JSON.parse(med.instructions) : med.instructions;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed); // Handle double stringification
      instructions = parsed || {};
    } catch(e) {
      console.log('Failed to parse instructions for med', med.id);
    }
    
    const frequency = instructions.frequency || 'Daily';
    const scheduledTimes = instructions.scheduled_times || [];
    const days = instructions.days || [];

    // Check if scheduled for today
    if (frequency === 'Specific Days' && !days.includes(todayName)) {
      return; // Skip this medicine for today
    }
    
    if (scheduledTimes.length === 0 || frequency === 'As Needed') {
      const medLog = logs?.find(log => log.medicine_id === med.id);
      flattenedMedicines.push({
        ...med,
        scheduled_time: null,
        status: medLog ? medLog.status : 'pending',
        logged_by_name: medLog?.logged_by ? usersMap[medLog.logged_by] : null
      });
      return;
    }

    // Split into slots
    scheduledTimes.forEach(timeStr => {
      // Find a log specifically for this scheduled_time (fallback to first available if old log format)
      const medLog = logs?.find(log => log.medicine_id === med.id && (log.scheduled_time === timeStr || !log.scheduled_time));
      
      flattenedMedicines.push({
        ...med,
        slot_id: `${med.id}-${timeStr}`, // Unique key for frontend
        scheduled_time: timeStr,
        status: medLog ? medLog.status : 'pending',
        logged_by_name: medLog?.logged_by ? usersMap[medLog.logged_by] : null
      });
    });
  });

  // Sort by time
  flattenedMedicines.sort((a, b) => {
    if (!a.scheduled_time) return -1;
    if (!b.scheduled_time) return 1;
    return a.scheduled_time.localeCompare(b.scheduled_time);
  });

  res.status(200).json(flattenedMedicines);
});

// 3. POST /api/v1/medicines/:id/logs
router.post('/:id/logs', async (req, res) => {
  const medicine_id = req.params.id;
  const { status, taken_at, scheduled_time } = req.body;
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

  if (String(med.circle_id) !== String(userCircleId)) {
    return res.status(403).json({ error: 'Unauthorized access to this medicine' });
  }

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  if (typeof status !== 'string') {
    return res.status(400).json({ error: 'Status must be a string' });
  }

  const { data, error } = await supabase
    .from('medicine_dose_logs')
    .insert([
      { 
        medicine_id, 
        circle_id: med.circle_id,
        status, 
        taken_at: taken_at || new Date().toISOString(),
        scheduled_time: scheduled_time || null,
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

// 4.5 DELETE /api/v1/medicines/:id
router.delete('/:id', async (req, res) => {
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

  if (String(med.circle_id) !== String(userCircleId)) {
    return res.status(403).json({ error: 'Unauthorized access to this medicine' });
  }

  // Manually delete logs to prevent foreign key constraint errors
  await supabase.from('medicine_dose_logs').delete().eq('medicine_id', medicine_id);

  const { error } = await supabase
    .from('medicines')
    .delete()
    .eq('id', medicine_id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json({ message: 'Medicine deleted successfully' });
});

// 5. GET /api/v1/medicines/analytics/compliance
// PERFORMANCE OPTIMIZATION: Ensure an index exists on medicine_dose_logs:
// CREATE INDEX idx_medicine_dose_logs_circle_taken ON medicine_dose_logs(circle_id, taken_at);
router.get('/analytics/compliance', async (req, res) => {
  const circleId = req.user.circle_id;

  if (!circleId) {
    return res.status(403).json({ error: 'User does not belong to a circle' });
  }

  const now = new Date();
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  // Fetch logs for the past 30 days (covers both 7d and 30d calculation)
  const { data: logs, error: logsError } = await supabase
    .from('medicine_dose_logs')
    .select('status, taken_at')
    .eq('circle_id', circleId)
    .gte('taken_at', thirtyDaysAgo.toISOString());

  if (logsError) return res.status(400).json({ error: logsError.message });

  const logs30d = logs;
  const logs7d = logs.filter(l => new Date(l.taken_at) >= sevenDaysAgo);

  const totalTracked30d = logs30d.length;
  const totalTaken30d = logs30d.filter(l => l.status === 'taken').length;
  
  const totalTracked7d = logs7d.length;
  const totalTaken7d = logs7d.filter(l => l.status === 'taken').length;
  const totalMissed7d = logs7d.filter(l => l.status === 'missed').length;

  let adherence_rate_30d = 0;
  if (totalTracked30d > 0) {
    adherence_rate_30d = Math.round((totalTaken30d / totalTracked30d) * 100);
  }

  let adherence_rate_7d = 0;
  if (totalTracked7d > 0) {
    adherence_rate_7d = Math.round((totalTaken7d / totalTracked7d) * 100);
  }

  let statusLabel = 'Attention Needed';
  if (adherence_rate_7d >= 90) statusLabel = 'Excellent';
  else if (adherence_rate_7d >= 75) statusLabel = 'Stable';

  res.status(200).json({
    adherence_rate_7d,
    adherence_rate_30d,
    total_taken: totalTaken7d,
    total_missed: totalMissed7d,
    status: statusLabel
  });
});

module.exports = router;
