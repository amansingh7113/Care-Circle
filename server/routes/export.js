const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authenticate = require('../middleware/authenticate');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

router.use(authenticate);

router.get('/report', async (req, res) => {
  try {
    const circleId = req.user.circle_id;
    if (!circleId) {
      return res.status(400).json({ error: 'User does not belong to a circle' });
    }

    const months = parseInt(req.query.months, 10) || 1;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startDateIso = startDate.toISOString();

    const [
      { data: sleepLogs, error: sleepError },
      { data: stepLogs, error: stepError },
      { data: bpLogs, error: bpError },
      { data: medicineLogs, error: medError },
      { data: documents, error: docError }
    ] = await Promise.all([
      supabase.from('sleep_logs').select('sleep_start, duration_minutes, is_auto_detected').eq('circle_id', circleId).gte('sleep_start', startDateIso).order('sleep_start', { ascending: false }),
      supabase.from('step_logs').select('date, step_count').eq('circle_id', circleId).gte('date', startDateIso).order('date', { ascending: false }),
      supabase.from('blood_pressure_logs').select('systolic, diastolic, pulse, logged_at').eq('circle_id', circleId).gte('logged_at', startDateIso).order('logged_at', { ascending: false }),
      supabase.from('medicine_dose_logs').select('id, taken_at, status, medicines(name, dosage)').eq('circle_id', circleId).gte('taken_at', startDateIso).order('taken_at', { ascending: false }),
      supabase.from('documents').select('title, category, created_at, file_url').eq('circle_id', circleId).in('category', ['Prescription', 'Reports']).gte('created_at', startDateIso).order('created_at', { ascending: false })
    ]);

    if (sleepError) console.error('Sleep fetch error:', sleepError);
    if (stepError) console.error('Steps fetch error:', stepError);
    if (bpError) console.error('BP fetch error:', bpError);
    if (medError) console.error('Medicine fetch error:', medError);
    if (docError) console.error('Documents fetch error:', docError);

    // Dynamically append authorization token to file_url for decryption
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : '';

    const formattedDocs = (documents || []).map(doc => {
      let fileUrl = doc.file_url;
      if (fileUrl && fileUrl.includes('/decrypt') && token) {
        fileUrl = `${fileUrl}&token=${token}`;
      }
      return { ...doc, file_url: fileUrl };
    });

    res.status(200).json({
      success: true,
      data: {
        sleep: sleepLogs || [],
        steps: stepLogs || [],
        bloodPressure: bpLogs || [],
        medicines: medicineLogs || [],
        documents: formattedDocs,
        period: {
          start: startDateIso,
          end: new Date().toISOString(),
          months
        }
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to generate export data' });
  }
});

module.exports = router;
