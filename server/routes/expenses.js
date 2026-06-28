const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const authenticate = require('../middleware/authenticate');
const { assertCircleMember, assertCircleRole } = require('../middleware/authorizer');
router.use(authenticate);

router.post('/', async (req, res) => {
  try {
    const { amount, category, description } = req.body;
    if (!amount || !category) {
      return res.status(400).json({ error: 'Amount and category are required' });
    }
    
    const circleId = req.user.circle_id;
    if (!circleId) {
      return res.status(403).json({ error: 'User is not part of any circle' });
    }

    try {
      assertCircleRole(req, circleId, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized to add expenses: Requires Admin or Caregiver role' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          circle_id: circleId,
          amount,
          category,
          description,
          logged_by: req.user.id
        }
      ])
      .select();

    if (error) return res.status(500).json({ error: 'Failed to create expense.' });
    return res.status(201).json({ data: data[0] });

  } catch (err) {
    console.error('Create expense error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const circleId = req.user.circle_id;
    if (!circleId) return res.status(403).json({ error: 'User is not part of any circle' });

    try {
      assertCircleMember(req, circleId);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this circle' });
    }

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

    if (expensesError) return res.status(500).json({ error: 'Failed to fetch expenses summary.' });

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
    console.error('Get expenses summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;

    const { data: exp, error: expError } = await supabase
      .from('expenses')
      .select('circle_id')
      .eq('id', expenseId)
      .single();

    if (expError || !exp) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    try {
      assertCircleRole(req, exp.circle_id, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to delete this expense: Requires Admin or Caregiver role' });
    }

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (error) {
      console.error('Delete expense error:', error);
      return res.status(400).json({ error: 'Failed to delete expense.' });
    }

    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error('Delete expense catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/budget', async (req, res) => {
  try {
    const { monthly_limit } = req.body;
    if (!monthly_limit || monthly_limit <= 0) {
      return res.status(400).json({ error: 'Valid monthly_limit is required' });
    }

    const circleId = req.user.circle_id;
    if (!circleId) return res.status(403).json({ error: 'User is not part of any circle' });

    try {
      assertCircleRole(req, circleId, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized to update circle budget: Requires Admin or Caregiver role' });
    }

    const { data, error } = await supabase
      .from('circle_budgets')
      .upsert({ circle_id: circleId, monthly_limit, updated_at: new Date().toISOString() }, { onConflict: 'circle_id' })
      .select()
      .single();
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('Update budget error:', err);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { amount, category, description } = req.body;

    const { data: exp, error: expError } = await supabase
      .from('expenses')
      .select('circle_id')
      .eq('id', expenseId)
      .single();

    if (expError || !exp) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    try {
      assertCircleRole(req, exp.circle_id, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to update this expense: Requires Admin or Caregiver role' });
    }

    const updateData = {};
    if (amount !== undefined) updateData.amount = amount;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;

    const { data, error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', expenseId)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
