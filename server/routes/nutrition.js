const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const authenticate = require('../middleware/authenticate');
const { assertCircleMember } = require('../middleware/authorizer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

router.use(authenticate);

async function checkAiQuota(circleId) {
  if (!circleId) return false;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('ai_insights_history')
    .select('*', { count: 'exact', head: true })
    .eq('circle_id', circleId)
    .gte('created_at', twentyFourHoursAgo);

  if (!error && count >= 30) {
    throw new Error('AI daily quota exceeded for this circle (Max 30 requests per 24 hours).');
  }
}

async function recordAiUsage(circleId, type) {
  if (!circleId) return;
  await supabase.from('ai_insights_history').insert([{
    circle_id: circleId,
    insight_data: { type, timestamp: new Date().toISOString() }
  }]);
}

// POST /api/v1/nutrition/scan
router.post('/scan', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Meal image is required' });
    const userCircleId = req.user.circle_id;

    if (userCircleId) {
      try {
        assertCircleMember(req, userCircleId);
        await checkAiQuota(userCircleId);
      } catch (quotaErr) {
        return res.status(429).json({ error: quotaErr.message });
      }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
    You are an expert nutritionist analyzing a meal.
    Identify the main food items in this image.
    Estimate the total calories, total sugar (in grams), and total sodium (in mg).
    Return ONLY a JSON object with these exact keys:
    - "food_items": A string summarizing the meal (e.g. "Dal, Rice, and Mixed Veg Sabzi")
    - "calories": Integer
    - "sugar_g": Integer
    - "sodium_mg": Integer
    - "meal_type": String (Breakfast, Lunch, Dinner, or Snack)
    
    Do not wrap in markdown blocks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype || "image/jpeg"
              }
            },
            { text: prompt }
          ]
        }
      ]
    });

    const parsedText = response.text.trim().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    let parsedData = {};
    try {
      parsedData = JSON.parse(parsedText);
    } catch(e) {
      console.error('Failed to parse AI nutrition response [REDACTED]');
      return res.status(400).json({ error: 'Could not parse response from AI' });
    }

    if (userCircleId) {
      await recordAiUsage(userCircleId, 'nutrition-scan');
    }

    res.status(200).json(parsedData);
  } catch (err) {
    console.error('Scan nutrition error [REDACTED]');
    res.status(500).json({ error: 'Failed to process meal image' });
  }
});

// POST /api/v1/nutrition
router.post('/', async (req, res) => {
  try {
    const circleId = req.user.circle_id;
    if (!circleId) return res.status(400).json({ error: 'User does not belong to a circle' });

    try {
      assertCircleMember(req, circleId);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this circle' });
    }

    const { meal_type, food_items, calories, sugar_g, sodium_mg, image_url } = req.body;

    const { data, error } = await supabase
      .from('nutrition_logs')
      .insert([{
        circle_id: circleId,
        logged_by: req.user.id,
        meal_type,
        food_items,
        calories: calories || 0,
        sugar_g: sugar_g || 0,
        sodium_mg: sodium_mg || 0,
        image_url
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data, message: 'Nutrition logged successfully' });
  } catch (error) {
    console.error('Error logging nutrition [REDACTED]');
    res.status(500).json({ error: 'Failed to log nutrition' });
  }
});

// GET /api/v1/nutrition
router.get('/', async (req, res) => {
  try {
    const circleId = req.user.circle_id;
    if (!circleId) return res.status(400).json({ error: 'User does not belong to a circle' });

    try {
      assertCircleMember(req, circleId);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this circle' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('circle_id', circleId)
      .eq('date', todayStr)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const totalCalories = data.reduce((sum, log) => sum + (log.calories || 0), 0);

    res.status(200).json({ logs: data, total_calories: totalCalories });
  } catch (error) {
    console.error('Error fetching nutrition [REDACTED]');
    res.status(500).json({ error: 'Failed to fetch nutrition logs' });
  }
});

module.exports = router;
