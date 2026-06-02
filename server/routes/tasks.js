const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co', 
  process.env.SUPABASE_ANON_KEY || 'placeholder_key'
);

// POST /api/v1/tasks
router.post('/', async (req, res) => {
  const { title, description, priority, assigned_to, due_date, circle_id } = req.body;
  
  const { data, error } = await supabase
    .from('tasks')
    .insert([
      { title, description, priority, assigned_to, due_date, circle_id, status: 'Todo' }
    ])
    .select();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data[0]);
});

// GET /api/v1/tasks
router.get('/', async (req, res) => {
  const { circle_id } = req.query;
  
  if (!circle_id) {
    return res.status(400).json({ error: 'circle_id is required' });
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('circle_id', circle_id)
    .in('status', ['Todo', 'In Progress']);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data);
});

// PATCH /api/v1/tasks/:taskId
router.patch('/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;

  if (!['Todo', 'In Progress', 'Done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .select();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data[0]);
});

module.exports = router;
