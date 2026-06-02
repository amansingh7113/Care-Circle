const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co', 
  process.env.SUPABASE_ANON_KEY || 'placeholder_key'
);

// POST /api/v1/medicines
router.post('/', async (req, res) => {
  const { name, dosage, instructions, scheduled_times, stock_quantity, refill_alert_threshold, circle_id } = req.body;
  
  const { data, error } = await supabase
    .from('medicines')
    .insert([
      { name, dosage, instructions, scheduled_times, stock_quantity, refill_alert_threshold, circle_id }
    ])
    .select();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data[0]);
});

// GET /api/v1/medicines
router.get('/', async (req, res) => {
  const { circle_id } = req.query;
  
  if (!circle_id) {
    return res.status(400).json({ error: 'circle_id is required' });
  }

  const { data, error } = await supabase
    .from('medicines')
    .select('*')
    .eq('circle_id', circle_id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data);
});

// PATCH /api/v1/medicines/logs/:logId
router.patch('/logs/:logId', async (req, res) => {
  const { logId } = req.params;
  const { status } = req.body;

  try {
    const { data: log, error: logError } = await supabase
      .from('medicine_dose_logs')
      .update({ status })
      .eq('id', logId)
      .select('medicine_id')
      .single();

    if (logError) throw logError;

    if (status === 'Taken' && log) {
      const medicineId = log.medicine_id;
      
      // Fetch current stock and threshold for decrement
      const { data: medicine, error: medError } = await supabase
        .from('medicines')
        .select('stock_quantity, refill_alert_threshold')
        .eq('id', medicineId)
        .single();
        
      if (medError) throw medError;
      
      const newStock = medicine.stock_quantity - 1;
      
      // Update stock
      const { error: updateError } = await supabase
        .from('medicines')
        .update({ stock_quantity: newStock })
        .eq('id', medicineId);
        
      if (updateError) throw updateError;
        
      if (newStock <= medicine.refill_alert_threshold) {
        console.log(`[REFILL ALERT TRIGGERED FOR MEDICINE_ID] ${medicineId}`);
      }
    }

    res.status(200).json({ success: true, logId, status });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
