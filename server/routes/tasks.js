const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const authenticate = require('../middleware/authenticate');
router.use(authenticate);

// 1. POST /api/v1/tasks
router.post('/', async (req, res) => {
  try {
    const { title, description, category, due_date, assigned_to, circle_id } = req.body;
    const userCircleId = req.user.circle_id;
  const targetCircleId = circle_id || userCircleId;

  if (String(targetCircleId) !== String(userCircleId)) {
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
    console.error('Create task error:', error);
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
  } catch (err) {
    console.error('Create task catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET /api/v1/circles/:circleId/tasks 
// (Mounted at /api/v1/tasks/circles/:circleId/tasks due to router mounting, similar to medicines)
router.get('/circles/:circleId/tasks', async (req, res) => {
  try {
    const { circleId } = req.params;
    const { status } = req.query; // e.g., ?status=pending
    const userCircleId = req.user.circle_id;

  if (String(circleId) !== String(userCircleId)) {
    return res.status(403).json({ error: 'Unauthorized access to this circle' });
  }

  let query = supabase
    .from('tasks')
    .select('*, assignee:users(name)')
    .eq('circle_id', circleId);

  if (status && ['pending', 'completed'].includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('due_date', { ascending: true });

  if (error) {
    console.error('Get tasks error:', error);
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data);
  } catch (err) {
    console.error('Get tasks catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. PATCH /api/v1/tasks/:id
router.patch('/:id', async (req, res) => {
  try {
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

  if (String(task.circle_id) !== String(userCircleId)) {
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
    console.error('Update task error:', error);
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data);
  } catch (err) {
    console.error('Update task catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. POST /api/v1/tasks/:id/comments
router.post('/:id/comments', async (req, res) => {
  try {
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

  if (String(task.circle_id) !== String(userCircleId)) {
    return res.status(403).json({ error: 'Unauthorized access to this task' });
  }

  const { data, error } = await supabase
    .from('task_comments')
    .insert([
      {
        task_id: taskId,
        user_id: userId,
        content: comment,
        created_at: new Date().toISOString()
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Add task comment error:', error);
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
  } catch (err) {
    console.error('Add task comment catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. GET /api/v1/tasks/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const taskId = req.params.id;
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

    if (String(task.circle_id) !== String(userCircleId)) {
      return res.status(403).json({ error: 'Unauthorized access to this task' });
    }

    const { data: comments, error } = await supabase
      .from('task_comments')
      .select('*, users:user_id(id, name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get task comments error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Flatten user data for the client
    const formattedComments = (comments || []).map(c => {
      const formatted = {
        ...c,
        comment: c.content, // Map content to comment for frontend compatibility
        user: c.users || { name: 'Unknown' }
      };
      delete formatted.users;
      return formatted;
    });

    res.status(200).json(formattedComments);
  } catch (err) {
    console.error('Get task comments catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. DELETE /api/v1/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
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

    if (String(task.circle_id) !== String(userCircleId)) {
      return res.status(403).json({ error: 'Unauthorized access to this task' });
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Delete task error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
