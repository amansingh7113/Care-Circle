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

// 0. Fetch user circles
router.get('/', async (req, res) => {
  try {
    const user_id = req.user.id;

    // Fetch from both legacy users table and circle_memberships table
    const { data: userRecords, error } = await supabase
      .from('users')
      .select('circle_id, role, circles(id, name, is_premium)')
      .eq('id', user_id);

    if (error) {
      console.error('Fetch circles error:', error);
      return res.status(500).json({ error: error.message });
    }

    const circles = userRecords.filter(r => r.circles).map(record => ({
      id: record.circles.id,
      name: record.circles.name,
      is_premium: record.circles.is_premium,
      role: record.role
    }));

    res.status(200).json({ circles });
  } catch (err) {
    console.error('Fetch circles catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 1. Create a new care circle
router.post('/', async (req, res) => {
  try {
    const { name, user_name } = req.body;
    const user_id = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Circle name is required' });
    }

    // Insert new circle
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .insert([{ name }])
      .select()
      .single();

    if (circleError) {
      console.error('Create circle error:', circleError);
      return res.status(500).json({ error: circleError.message });
    }

    // Upsert the user into the users table with 'Admin' role
    const { error: userError } = await supabase
      .from('users')
      .upsert([{ 
        id: user_id, 
        circle_id: circle.id, 
        name: user_name || req.user.phone_number || 'Caregiver', 
        role: 'Admin' 
      }]);

    if (userError) {
      console.error('Upsert user admin role error:', userError);
      return res.status(500).json({ error: userError.message });
    }

    // Explicitly insert into circle_memberships
    await supabase.from('circle_memberships').upsert([{
      user_id,
      circle_id: circle.id,
      role: 'Admin',
      status: 'active'
    }]);

    res.status(201).json({
      message: 'Circle created successfully',
      circle
    });
  } catch (err) {
    console.error('Create circle catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Fetch details for a specific care circle
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    try {
      assertCircleMember(req, id);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this circle' });
    }

    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('*')
      .eq('id', id)
      .single();

    if (circleError) {
      console.error('Get circle error:', circleError);
      return res.status(404).json({ error: 'Circle not found' });
    }

    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('circle_id', id);

    if (membersError) {
      console.error('Get circle members error:', membersError);
      return res.status(500).json({ error: membersError.message });
    }

    res.status(200).json({
      circle,
      members
    });
  } catch (err) {
    console.error('Get circle catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Generate invite code
router.post('/:id/invite', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    try {
      assertCircleRole(req, id, ['Admin']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Only circle Admins can generate invites' });
    }

    if (!role || !['Admin', 'Caregiver', 'Viewer', 'Patient'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required' });
    }

    // Create an invite token using JWT
    const invitePayload = {
      circle_id: id,
      role: role,
      type: 'invite'
    };

    const inviteToken = jwt.sign(invitePayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    const inviteCode = Buffer.from(inviteToken).toString('base64');

    res.status(200).json({
      message: 'Invite generated',
      inviteCode,
      role
    });
  } catch (err) {
    console.error('Generate invite catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Join a circle
router.post('/join', async (req, res) => {
  const { inviteCode, user_name } = req.body;
  const user_id = req.user.id;

  if (!inviteCode) {
    return res.status(400).json({ error: 'inviteCode is required' });
  }

  try {
    const inviteToken = Buffer.from(inviteCode, 'base64').toString('ascii');
    const decoded = jwt.verify(inviteToken, process.env.JWT_SECRET);

    if (decoded.type !== 'invite' || !decoded.circle_id || !decoded.role) {
      return res.status(400).json({ error: 'Invalid invite code structure' });
    }

    const { circle_id, role } = decoded;

    // Verify circle exists
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('id')
      .eq('id', circle_id)
      .single();

    if (circleError) {
      console.error('Join circle check error:', circleError);
      return res.status(404).json({ error: 'Circle not found' });
    }

    // Upsert user into circle
    const { error: userError } = await supabase
      .from('users')
      .upsert([{ 
        id: user_id, 
        circle_id: circle.id, 
        name: user_name || req.user.phone_number || 'Family Member', 
        role: role 
      }]);

    if (userError) {
      console.error('Join circle user upsert error:', userError);
      return res.status(500).json({ error: userError.message });
    }

    // Explicitly insert into circle_memberships
    await supabase.from('circle_memberships').upsert([{
      user_id,
      circle_id: circle.id,
      role,
      status: 'active'
    }]);

    res.status(200).json({
      message: 'Joined circle successfully',
      circle_id: circle.id,
      role
    });

  } catch (err) {
    console.error('Join circle catch error:', err);
    return res.status(400).json({ error: 'Invalid or expired invite code' });
  }
});

// 5. Remove member from circle
router.delete('/:id/members/:memberId', async (req, res) => {
  const { id, memberId } = req.params;

  try {
    try {
      assertCircleRole(req, id, ['Admin']);
    } catch (authErr) {
      return res.status(403).json({ error: 'Only circle Admins can remove members' });
    }

    // Prevent removing the last admin of a circle (CC-005)
    const { data: admins, error: adminErr } = await supabase
      .from('users')
      .select('id')
      .eq('circle_id', id)
      .eq('role', 'Admin');

    if (adminErr) {
      return res.status(500).json({ error: 'Failed to verify admin count' });
    }

    if (admins && admins.length === 1 && String(admins[0].id) === String(memberId)) {
      return res.status(400).json({ error: 'Cannot remove the last Admin of the circle' });
    }

    const { error } = await supabase
      .from('users')
      .update({ circle_id: null })
      .eq('id', memberId)
      .eq('circle_id', id); // ensure they are actually in this circle

    if (error) {
      console.error('Remove member error:', error);
      return res.status(500).json({ error: error.message });
    }

    await supabase.from('circle_memberships').update({ status: 'deactivated' }).eq('user_id', memberId).eq('circle_id', id);

    res.status(200).json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error('Remove member catch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
