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

router.post('/generate-manual', async (req, res) => {
  const { prescription_id, force_refresh } = req.body;
  const circleId = req.user.circle_id;

  if (!circleId) {
    return res.status(400).json({ error: 'User does not belong to a circle' });
  }

  if (!prescription_id) {
    return res.status(400).json({ error: 'prescription_id is required' });
  }

  try {
    // 1. Check Cache
    if (!force_refresh) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
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
      const response = await fetch(fileUrl);
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro',
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

    const outputJsonString = response.text;
    const outputJson = JSON.parse(outputJsonString);

    // 5. Save to History
    await supabase.from('ai_insights_history').insert([{
      circle_id: circleId,
      prescription_id,
      insight_data: outputJson
    }]);

    res.status(200).json(outputJson);
  } catch (error) {
    console.error('Insights generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate insights' });
  }
});

module.exports = router;
