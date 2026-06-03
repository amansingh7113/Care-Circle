const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

router.post('/', async (req, res) => {
  try {
    const { amount, category, description } = req.body;
    if (!amount || !category) {
      return res.status(400).json({ error: 'Amount and category are required' });
    }
    
    if (!req.user.circle_id) {
      return res.status(403).json({ error: 'User is not part of any circle' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          circle_id: req.user.circle_id,
          amount,
          category,
          description,
          logged_by: req.user.id
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
    const circleId = req.user.circle_id;
    if (!circleId) return res.status(403).json({ error: 'User is not part of any circle' });

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
