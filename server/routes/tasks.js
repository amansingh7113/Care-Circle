const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const authenticate = require('../middleware/authenticate');
const { assertCircleMember, assertCircleRole } = require('../middleware/authorizer');
router.use(authenticate);

// Helper to verify a user is in the circle before assigning them (CC-013)
async function verifyUserInCircle(userId, circleId) {
  if (!userId || !circleId) return true;
  const { data: member } = await supabase.from('circle_memberships').select('user_id').eq('user_id', userId).eq('circle_id', circleId).eq('status', 'active').maybeSingle();
  if (member) return true;
  const { data: user } = await supabase.from('users').select('id').eq('id', userId).eq('circle_id', circleId).maybeSingle();
  if (user) return true;
  throw new Error('Assigned user does not belong to this circle');
}

// 1. POST /api/v1/tasks
router.post('/', async (req, res) => {
  try {
    const { title, description, category, due_date, assigned_to, circle_id } = req.body;
    const userCircleId = req.user.circle_id;
    const targetCircleId = circle_id || userCircleId;

    if (!targetCircleId) {
      return res.status(403).json({ error: 'Unauthorized: User is not part of any circle' });
    }

    try {
      assertCircleRole(req, targetCircleId, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized to add tasks to this circle: Requires Admin or Caregiver role' });
    }

    if (!title || !category || !due_date) {
      return res.status(400).json({ error: 'Missing required fields: title, category, due_date' });
    }

    if (assigned_to) {
      try {
        await verifyUserInCircle(assigned_to, targetCircleId);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
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
      return res.status(400).json({ error: 'Failed to create task.' });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Create task catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET /api/v1/circles/:circleId/tasks 
router.get('/circles/:circleId/tasks', async (req, res) => {
  try {
    const { circleId } = req.params;
    const { status } = req.query;

    try {
      assertCircleMember(req, circleId);
    } catch (authErr) {
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
      return res.status(400).json({ error: 'Failed to get tasks.' });
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

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('circle_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    try {
      assertCircleRole(req, task.circle_id, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to update this task: Requires Admin or Caregiver role' });
    }

    if (assigned_to) {
      try {
        await verifyUserInCircle(assigned_to, task.circle_id);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
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
      return res.status(400).json({ error: 'Failed to update task.' });
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
    const userId = req.user.id;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('circle_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    try {
      assertCircleMember(req, task.circle_id);
    } catch (authErr) {
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
      return res.status(400).json({ error: 'Failed to add task comment.' });
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

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('circle_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    try {
      assertCircleMember(req, task.circle_id);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this task' });
    }

    const { data: comments, error } = await supabase
      .from('task_comments')
      .select('*, users:user_id(id, name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get task comments error:', error);
      return res.status(400).json({ error: 'Failed to get task comments.' });
    }

    const formattedComments = (comments || []).map(c => {
      const formatted = {
        ...c,
        comment: c.content,
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

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('circle_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    try {
      assertCircleRole(req, task.circle_id, ['Admin', 'Caregiver']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to delete this task: Requires Admin or Caregiver role' });
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Delete task error:', error);
      return res.status(400).json({ error: 'Failed to delete task.' });
    }

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
