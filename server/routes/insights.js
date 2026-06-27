const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy_key_if_not_set' });

const authenticate = require('../middleware/authenticate');
const createRateLimiter = require('../middleware/rateLimiter');
const { assertCircleMember } = require('../middleware/authorizer');

router.use(authenticate);
router.use(createRateLimiter({ windowMs: 60 * 1000, max: 10 }));

router.post('/generate-manual', async (req, res) => {
  const { prescription_id, force_refresh, circle_id } = req.body;
  const circleId = circle_id || req.user.circle_id;

  if (!circleId) {
    return res.status(403).json({ error: 'Unauthorized: No circle_id provided' });
  }

  try {
    assertCircleMember(req, circleId);
  } catch (authErr) {
    return res.status(403).json({ error: 'Unauthorized access to this circle insights' });
  }

  if (!prescription_id) {
    return res.status(400).json({ error: 'prescription_id is required' });
  }

  try {
    // Check AI Quota: Max 20 insights per circle per 24 hours (CC-010)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: quotaCount, error: quotaErr } = await supabase
      .from('ai_insights_history')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .gte('created_at', twentyFourHoursAgo);

    if (!quotaErr && quotaCount >= 20) {
      return res.status(429).json({ error: 'AI daily quota exceeded for this circle (Max 20 requests per 24 hours).' });
    }

    // 1. Check Cache
    if (!force_refresh) {
      const { data: cachedInsight } = await supabase
        .from('ai_insights_history')
        .select('insight_data')
        .eq('circle_id', circleId)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedInsight) {
        return res.status(200).json(cachedInsight.insight_data);
      }
    }

    // 2. Fetch Prescription Document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('file_url')
      .eq('id', prescription_id)
      .eq('circle_id', circleId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Prescription document not found' });
    }

    let fileUrl = document.file_url;
    let base64Image = '';
    let mimeType = 'image/jpeg'; // Default

    // Determine if fileUrl is a full URL or a storage path
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      try {
        const parsedUrl = new URL(fileUrl);
        const host = parsedUrl.hostname.toLowerCase();
        const isAllowedDomain = host.endsWith('.supabase.co') || host.endsWith('.supabase.in') || host.endsWith('.carecircle.in');
        const isBannedIP = host === 'localhost' || host === '127.0.0.1' || host.startsWith('169.254.') || host.startsWith('10.') || host.startsWith('192.168.');
        
        if (!isAllowedDomain || isBannedIP) {
          return res.status(400).json({ error: 'Disallowed file URL host' });
        }
      } catch (urlErr) {
        return res.status(400).json({ error: 'Invalid file URL structure' });
      }

      // Hardened fetch with abort signal timeout (CC-009)
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(fileUrl, { signal: controller.signal });
      clearTimeout(id);
      
      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to fetch prescription image from URL' });
      }
      const arrayBuffer = await response.arrayBuffer();
      base64Image = Buffer.from(arrayBuffer).toString('base64');
      mimeType = response.headers.get('content-type') || 'image/jpeg';
    } else {
      // Fetch from Supabase storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .download(fileUrl);

      if (storageError) {
        return res.status(500).json({ error: 'Failed to download prescription image from storage' });
      }
      const arrayBuffer = await storageData.arrayBuffer();
      base64Image = Buffer.from(arrayBuffer).toString('base64');
      mimeType = storageData.type || 'image/jpeg';
    }

    // 3. Fetch Telemetry Data (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

    const [stepsRes, sleepRes, medsRes] = await Promise.all([
      supabase.from('step_logs').select('date, step_count').eq('circle_id', circleId).gte('date', thirtyDaysAgoIso),
      supabase.from('sleep_logs').select('sleep_start, sleep_end, quality, notes').eq('circle_id', circleId).gte('created_at', thirtyDaysAgoIso),
      supabase.from('medicine_dose_logs').select('status, taken_at').eq('circle_id', circleId).gte('taken_at', thirtyDaysAgoIso)
    ]);

    const telemetry = {
      steps: stepsRes.data || [],
      sleep: sleepRes.data || [],
      medicines: medsRes.data || []
    };

    const telemetrySummary = JSON.stringify(telemetry);

    // 4. Generate AI Insight
    const prompt = `Analyze the provided medical prescription and the patient's 30-day telemetry data below.
    Telemetry Data:
    ${telemetrySummary}
    
    Correlate the instructions from the prescription with the patient's recent activity (steps), sleep quality, and medicine adherence. Provide actionable insights.`;

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI generation timed out')), 30000));
    const generatePromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType
              }
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: {
            telemetry_correlations: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Strings matching tracking metrics to prescription instructions"
            },
            whats_right: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Strings highlighting good health markers"
            },
            needs_attention: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Strings highlighting warnings or deviations"
            },
            actionable_recommendations: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Strings with lifestyle adjustments"
            }
          },
          required: ["telemetry_correlations", "whats_right", "needs_attention", "actionable_recommendations"]
        }
      }
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const outputJsonString = response.text;
    let outputJson;
    try {
      outputJson = JSON.parse(outputJsonString);
      // Schema validation
      const requiredKeys = ['telemetry_correlations', 'whats_right', 'needs_attention', 'actionable_recommendations'];
      for (const key of requiredKeys) {
        if (!outputJson[key]) {
          outputJson[key] = [];
        }
      }
    } catch (parseErr) {
      console.warn('Failed to parse AI response, using fallback schema [REDACTED]');
      outputJson = {
        telemetry_correlations: [],
        whats_right: [],
        needs_attention: [],
        actionable_recommendations: ['AI analysis was temporarily unavailable. Please consult your healthcare provider.']
      };
    }

    // 5. Save to History
    await supabase.from('ai_insights_history').insert([{
      circle_id: circleId,
      prescription_id,
      insight_data: outputJson
    }]);

    res.status(200).json(outputJson);
  } catch (error) {
    console.error('Insights generation error [REDACTED]');
    res.status(500).json({ error: error.message || 'Failed to generate insights' });
  }
});

router.get('/health-score', async (req, res) => {
  try {
    const circleId = req.query.circle_id || req.user.circle_id;
    if (!circleId) {
      return res.status(403).json({ error: 'Unauthorized: No circle_id provided' });
    }

    try {
      assertCircleMember(req, circleId);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this circle' });
    }

    const { data: insight, error } = await supabase
      .from('ai_insights_history')
      .select('insight_data, created_at')
      .eq('circle_id', circleId)
      .is('prescription_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!insight || !insight.insight_data) {
      return res.status(200).json({ health_score: 'Status Unknown', status: 'Unknown', period: null });
    }

    res.status(200).json({
      health_score: insight.insight_data.health_score,
      status: insight.insight_data.status,
      period: insight.insight_data.period,
      missing_data: insight.insight_data.missing_data,
      created_at: insight.created_at
    });
  } catch (error) {
    console.error('Error fetching health score [REDACTED]');
    res.status(500).json({ error: 'Failed to fetch health score' });
  }
});

router.get('/correlations', async (req, res) => {
  try {
    const circleId = req.query.circle_id || req.user.circle_id;
    if (!circleId) {
      return res.status(403).json({ error: 'Unauthorized: No circle_id provided' });
    }

    try {
      assertCircleMember(req, circleId);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this circle' });
    }

    const { data: insight, error } = await supabase
      .from('ai_insights_history')
      .select('insight_data, created_at')
      .eq('circle_id', circleId)
      .is('prescription_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!insight || !insight.insight_data) {
      return res.status(200).json({ correlations: [] });
    }

    res.status(200).json({
      correlations: insight.insight_data.correlations || [],
      period: insight.insight_data.period,
      created_at: insight.created_at
    });
  } catch (error) {
    console.error('Error fetching correlations [REDACTED]');
    res.status(500).json({ error: 'Failed to fetch correlations' });
  }
});

router.get('/doctor-summary', async (req, res) => {
  try {
    const circleId = req.query.circle_id || req.user.circle_id;
    if (!circleId) {
      return res.status(403).json({ error: 'Unauthorized: No circle_id provided' });
    }

    try {
      assertCircleMember(req, circleId);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this circle' });
    }

    // Check AI Quota: Max 20 insights per circle per 24 hours (CC-010)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: quotaCount, error: quotaErr } = await supabase
      .from('ai_insights_history')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .gte('created_at', twentyFourHoursAgo);

    if (!quotaErr && quotaCount >= 20) {
      return res.status(429).json({ error: 'AI daily quota exceeded for this circle (Max 20 requests per 24 hours).' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

    const [stepsRes, sleepRes, medsRes, visitsRes] = await Promise.all([
      supabase.from('step_logs').select('date, step_count').eq('circle_id', circleId).gte('date', thirtyDaysAgoIso),
      supabase.from('sleep_logs').select('sleep_start, sleep_end, quality, notes').eq('circle_id', circleId).gte('created_at', thirtyDaysAgoIso),
      supabase.from('medicine_dose_logs').select('status, taken_at').eq('circle_id', circleId).gte('taken_at', thirtyDaysAgoIso),
      supabase.from('doctor_visits').select('doctor_name, visit_date, reason, notes').eq('circle_id', circleId).order('visit_date', { ascending: false })
    ]);

    const telemetry = {
      doctor_visits: visitsRes.data || [],
      steps: stepsRes.data || [],
      sleep: sleepRes.data || [],
      medicines: medsRes.data || []
    };

    const telemetrySummary = JSON.stringify(telemetry);

    const prompt = `You are a professional medical assistant writing a concise 1-page health briefing and summary for a patient's care circle.
Based on the following doctor visits history (doctor names, reasons, notes) and 30-day telemetry data (steps, sleep quality, medication adherence), write a clear, highly structured, readable markdown summary.
First, summarize the recent Doctor Visits, including key advice, diagnoses, or notes from the doctors.
Then, correlate these visits with the patient's recent telemetry trends (activity status, sleep patterns, medication adherence). Highlight any missed doses or areas needing attention.

Data:
${telemetrySummary}`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI generation timed out')), 30000));
    const response = await Promise.race([generatePromise, timeoutPromise]);

    const summaryText = response.text;

    // Record usage in history
    await supabase.from('ai_insights_history').insert([{
      circle_id: circleId,
      insight_data: { type: 'doctor-summary', summary: summaryText }
    }]);

    res.status(200).json({ summary: summaryText });
  } catch (error) {
    console.error('Error generating doctor summary [REDACTED]');
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

module.exports = router;
