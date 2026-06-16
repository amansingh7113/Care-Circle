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

module.exports = authenticate;
