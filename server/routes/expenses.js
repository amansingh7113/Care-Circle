const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder_key');

router.post('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: profileError } = await supabase
      .from('users')
      .select('circle_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userData) return res.status(404).json({ error: 'User profile not found' });

    const { amount, category, description } = req.body;
    if (!amount || !category) {
      return res.status(400).json({ error: 'Amount and category are required' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          circle_id: userData.circle_id,
          amount,
          category,
          description,
          logged_by: user.id
        }
      ])
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data: data[0] });

  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: userData, error: profileError } = await supabase
      .from('users')
      .select('circle_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userData) return res.status(404).json({ error: 'User profile not found' });
    const circleId = userData.circle_id;

    // Get current month dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('circle_id', circleId)
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth);

    if (expensesError) return res.status(500).json({ error: expensesError.message });

    const { data: budgetData, error: budgetError } = await supabase
      .from('circle_budgets')
      .select('monthly_limit')
      .eq('circle_id', circleId)
      .single();

    const monthly_limit = budgetData ? budgetData.monthly_limit : 10000.00; // Default limit
    const total_spent = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    return res.status(200).json({
      total_spent,
      monthly_limit,
      expenses
    });

  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
