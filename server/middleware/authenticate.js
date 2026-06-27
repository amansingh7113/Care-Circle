const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, phone_number, role, circle_id }
    
    // Fetch latest profile and multi-circle memberships from DB to prevent stale token authorization (CC-004, CC-008, CC-016)
    const { data: dbUser } = await supabase.from('users').select('id, role, circle_id').eq('id', req.user.id).single();
    if (dbUser) {
      req.user.role = dbUser.role || req.user.role;
      req.user.circle_id = dbUser.circle_id; // Explicitly override, setting to null if removed
      
      // Fetch multi-circle memberships
      const { data: memberships } = await supabase.from('circle_memberships').select('circle_id, role, status').eq('user_id', req.user.id);
      req.user.circle_memberships = memberships || [];
    } else {
      // User row does not exist in users table. Allow only initial circle setup routes, otherwise reject.
      const path = req.baseUrl + req.path;
      const isCircleRoute = path.startsWith('/api/v1/circles') || path.startsWith('/api/v1/auth');
      if (!isCircleRoute) {
        return res.status(401).json({ error: 'User account not found or deactivated' });
      }
      req.user.circle_id = null;
      req.user.circle_memberships = [];
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticate;
