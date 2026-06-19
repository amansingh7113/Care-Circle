const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const authenticate = require('../middleware/authenticate');
router.use(authenticate);

// 1. POST /api/v1/medicines
router.post('/', async (req, res) => {
  try {
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

  const instructions = JSON.stringify({ frequency, scheduled_times: scheduled_times || [], days: days || [] });

  const { data, error } = await supabase
    .from('medicines')
    .insert([
      { name, dosage, instructions, circle_id: targetCircleId, stock_quantity, refill_alert_threshold }
    ])
    .select()
    .single();

  if (error) {
    console.error('Add medicine error:', error);
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
  } catch (err) {
    console.error('Create medicine error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET /api/v1/circles/:circleId/medicines (Implemented here as well for convenience, but ideally mounted correctly in index.js)
router.get('/circles/:circleId/medicines', async (req, res) => {
  try {
    const { circleId } = req.params;
  const userCircleId = req.user.circle_id;

  if (String(circleId) !== String(userCircleId)) {
    return res.status(403).json({ error: 'Unauthorized access to this circle' });
  }

  const { data: medicines, error } = await supabase
    .from('medicines')
    .select('*')
    .eq('circle_id', circleId)
    .eq('is_archived', false);

  if (error) {
    console.error('Get medicines error:', error);
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
    const { data: usersData } = await supabase.from('users').select('id, name').in('id', userIds);
    usersData?.forEach(u => { usersMap[u.id] = u.name || 'Family Member'; });
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
  } catch (err) {
    console.error('Get medicines error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. POST /api/v1/medicines/:id/logs
router.post('/:id/logs', async (req, res) => {
  try {
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
    console.error('Log medicine error:', error);
    return res.status(400).json({ error: error.message });
  }

  // Stock decrement logic
  if (status === 'taken') {
    const { data: currentMed, error: currentMedError } = await supabase
      .from('medicines')
      .select('name, stock_quantity, refill_alert_threshold')
      .eq('id', medicine_id)
      .single();

    if (!currentMedError && currentMed) {
      let currentStock = currentMed.stock_quantity || 0;
      if (currentStock > 0) {
        currentStock -= 1;
        const { error: updateError } = await supabase
          .from('medicines')
          .update({ stock_quantity: currentStock })
          .eq('id', medicine_id);

        if (!updateError) {
          const threshold = currentMed.refill_alert_threshold || 5;
          if (currentStock === threshold) {
            await supabase.from('notifications').insert([{
              circle_id: med.circle_id,
              type: 'REFILL_ALERT',
              priority: 'high',
              context: { medicine_name: currentMed.name, remaining: currentStock },
              title: `Refill Alert: ${currentMed.name}`,
              body: `Only ${currentStock} doses remaining for ${currentMed.name}.`
            }]);
          }
        }
      }
    }
  }

  res.status(201).json(data);
  } catch (err) {
    console.error('Log medicine error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. GET /api/v1/medicines/:id/logs
router.get('/:id/logs', async (req, res) => {
  try {
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
    console.error('Get medicine logs error:', error);
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data);
  } catch (err) {
    console.error('Get medicine logs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4.5 DELETE /api/v1/medicines/:id
router.delete('/:id', async (req, res) => {
  try {
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

  const { error } = await supabase
    .from('medicines')
    .update({ is_archived: true })
    .eq('id', medicine_id);

  if (error) {
    console.error('Delete medicine error:', error);
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json({ message: 'Medicine deleted successfully' });
  } catch (err) {
    console.error('Delete medicine error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4.6 PATCH /api/v1/medicines/:id/archive
router.patch('/:id/archive', async (req, res) => {
  try {
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

  const { error } = await supabase
    .from('medicines')
    .update({ is_archived: true })
    .eq('id', medicine_id);

  if (error) {
    console.error('Archive medicine error:', error);
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json({ message: 'Medicine archived successfully' });
  } catch (err) {
    console.error('Archive medicine error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4.7 POST /api/v1/medicines/voice-log
router.post('/voice-log', async (req, res) => {
  try {
    const { transcript } = req.body;
  const userCircleId = req.user.circle_id;

  if (!transcript) return res.status(400).json({ error: 'Transcript is required' });

  const { data: medicines, error: medError } = await supabase
    .from('medicines')
    .select('id, name')
    .eq('circle_id', userCircleId)
    .eq('is_archived', false);

  if (medError) return res.status(500).json({ error: 'Failed to fetch medicines' });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
    You are an assistant that parses voice logs for taking medicine.
    User transcript: "${transcript}"
    Available medicines: ${JSON.stringify(medicines)}
    
    Return a JSON array of objects, where each object has the following keys:
    - "medicine_id": the id of the medicine from the provided list, or null if it cannot be determined.
    - "medicine_name": the name of the medicine.
    - "dosage": the dosage mentioned (or null if not mentioned).
    - "action": either "taken" or "skipped".
    
    If none match or cannot be parsed, return an empty array [].
    Output purely JSON. Do not wrap in markdown blocks.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    
    const parsedText = response.text.trim().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    let parsedData = [];
    try {
      parsedData = JSON.parse(parsedText);
    } catch(e) {
      console.error('Failed to parse AI response:', parsedText);
      return res.status(400).json({ error: 'Could not parse response from AI' });
    }

    if (!Array.isArray(parsedData) || parsedData.length === 0) {
       return res.status(400).json({ error: 'Could not match any medicines from transcript' });
    }

    res.status(200).json({ message: 'Voice log parsed successfully', parsedData });

  } catch (error) {
    console.error('Voice log error:', error);
    res.status(500).json({ error: 'Failed to process voice log' });
  }
  } catch (err) {
    console.error('Voice log route error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4.8 POST /api/v1/medicines/voice-log-audio
router.post('/voice-log-audio', upload.single('audio'), async (req, res) => {
  try {
    const userCircleId = req.user.circle_id;

    if (!req.file) return res.status(400).json({ error: 'Audio file is required' });

    const { data: medicines, error: medError } = await supabase
      .from('medicines')
      .select('id, name')
      .eq('circle_id', userCircleId)
      .eq('is_archived', false);

    if (medError) return res.status(500).json({ error: 'Failed to fetch medicines' });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
      You are an assistant that parses voice logs for taking medicine.
      Listen to the audio and extract information about the medicine(s) the user interacted with.
      Available medicines: ${JSON.stringify(medicines)}
      
      Return a JSON array of objects, where each object has the following keys:
      - "medicine_id": the id of the medicine from the provided list, or null if it cannot be determined.
      - "medicine_name": the name of the medicine.
      - "dosage": the dosage mentioned (or null if not mentioned).
      - "action": either "taken" or "skipped".
      
      If none match or cannot be parsed, return an empty array [].
      Output purely JSON. Do not wrap in markdown blocks.`;
      
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: req.file.buffer.toString("base64"),
                    mimeType: (!req.file.mimetype || req.file.mimetype === 'application/octet-stream') ? "audio/mp4" : req.file.mimetype
                  }
                },
                { text: prompt }
              ]
            }
          ]
      });
      
      const parsedText = response.text.trim().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
      let parsedData = [];
      try {
        parsedData = JSON.parse(parsedText);
      } catch(e) {
        console.error('Failed to parse AI response:', parsedText);
        return res.status(400).json({ error: 'Could not parse response from AI' });
      }

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
         return res.status(400).json({ error: 'Could not match any medicines from voice' });
      }

      res.status(200).json({ message: 'Voice log parsed successfully', parsedData });

    } catch (error) {
      console.error('Voice log error:', error);
      res.status(500).json({ error: 'Failed to process voice log' });
    }
  } catch (err) {
    console.error('Voice log route error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. GET /api/v1/medicines/analytics/compliance
// PERFORMANCE OPTIMIZATION: Ensure an index exists on medicine_dose_logs:
// CREATE INDEX idx_medicine_dose_logs_circle_taken ON medicine_dose_logs(circle_id, taken_at);
router.get('/analytics/compliance', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('Compliance analytics error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. PATCH /api/v1/medicines/:id
router.patch('/:id', async (req, res) => {
  try {
    const medicineId = req.params.id;
    const { name, dosage, frequency, scheduled_times, days, stock_quantity, refill_alert_threshold } = req.body;
    const userCircleId = req.user.circle_id;

    const { data: med, error: medError } = await supabase
      .from('medicines')
      .select('circle_id, instructions')
      .eq('id', medicineId)
      .single();

    if (medError || !med) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    if (String(med.circle_id) !== String(userCircleId)) {
      return res.status(403).json({ error: 'Unauthorized access to this medicine' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (dosage !== undefined) updates.dosage = dosage;
    if (stock_quantity !== undefined) updates.stock_quantity = stock_quantity;
    if (refill_alert_threshold !== undefined) updates.refill_alert_threshold = refill_alert_threshold;

    // Handle instructions JSON update
    if (frequency !== undefined || scheduled_times !== undefined || days !== undefined) {
      let currentInstructions = {};
      try {
        currentInstructions = typeof med.instructions === 'string' ? JSON.parse(med.instructions) : med.instructions;
      } catch (e) {}

      updates.instructions = JSON.stringify({
        ...currentInstructions,
        ...(frequency !== undefined && { frequency }),
        ...(scheduled_times !== undefined && { scheduled_times }),
        ...(days !== undefined && { days })
      });
    }

    const { data, error } = await supabase
      .from('medicines')
      .update(updates)
      .eq('id', medicineId)
      .select()
      .single();

    if (error) {
      console.error('Update medicine error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Update medicine catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
