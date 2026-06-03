const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Authentication Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, phone_number, role, circle_id }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(authenticate);

// 1. POST /api/v1/tasks
router.post('/', async (req, res) => {
  const { title, description, category, due_date, assigned_to, circle_id } = req.body;
  const userCircleId = req.user.circle_id;
  const targetCircleId = circle_id || userCircleId;

  if (targetCircleId !== userCircleId) {
    return res.status(403).json({ error: 'Unauthorized to add tasks to this circle' });
  }

  if (!title || !category || !due_date) {
    return res.status(400).json({ error: 'Missing required fields: title, category, due_date' });
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert([
      { 
        title, 
        description, 
        category, 
        due_date, 
        assigned_to: assigned_to || null, 
        circle_id: targetCircleId, 
        status: 'pending' 
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
});

// 2. GET /api/v1/circles/:circleId/tasks 
// (Mounted at /api/v1/tasks/circles/:circleId/tasks due to router mounting, similar to medicines)
router.get('/circles/:circleId/tasks', async (req, res) => {
  const { circleId } = req.params;
  const { status } = req.query; // e.g., ?status=pending
  const userCircleId = req.user.circle_id;

  if (circleId !== userCircleId) {
    return res.status(403).json({ error: 'Unauthorized access to this circle' });
  }

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('circle_id', circleId);

  if (status && ['pending', 'completed'].includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('due_date', { ascending: true });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data);
});

// 3. PATCH /api/v1/tasks/:id
router.patch('/:id', async (req, res) => {
  const taskId = req.params.id;
  const { title, description, category, due_date, assigned_to, status } = req.body;
  const userCircleId = req.user.circle_id;

  // Verify task belongs to user's circle
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('circle_id')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.circle_id !== userCircleId) {
    return res.status(403).json({ error: 'Unauthorized access to this task' });
  }

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (due_date !== undefined) updates.due_date = due_date;
  if (assigned_to !== undefined) updates.assigned_to = assigned_to;
  if (status !== undefined) {
    if (!['pending', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending or completed.' });
    }
    updates.status = status;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data);
});

// 4. POST /api/v1/tasks/:id/comments
router.post('/:id/comments', async (req, res) => {
  const taskId = req.params.id;
  const { comment } = req.body;
  const userCircleId = req.user.circle_id;
  const userId = req.user.id;

  if (!comment) {
    return res.status(400).json({ error: 'Comment is required' });
  }

  // Verify task belongs to user's circle
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('circle_id')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.circle_id !== userCircleId) {
    return res.status(403).json({ error: 'Unauthorized access to this task' });
  }

  const { data, error } = await supabase
    .from('task_comments')
    .insert([
      {
        task_id: taskId,
        user_id: userId,
        comment,
        created_at: new Date().toISOString()
      }
    ])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
});

module.exports = router;
