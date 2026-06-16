require('dotenv').config();
const validateEnv = require('./config/envCheck');
validateEnv();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Create a single supabase client for interacting with your database
const supabase = createClient(supabaseUrl, supabaseKey);

const authRouter = require('./routes/auth');
const circlesRouter = require('./routes/circles');
const medicinesRouter = require('./routes/medicines');
const tasksRouter = require('./routes/tasks');
const doctorVisitsRouter = require('./routes/doctorVisits');
const expensesRouter = require('./routes/expenses');
const vitalsRouter = require('./routes/vitals');
const sleepRouter = require('./routes/sleep');
const stepsRouter = require('./routes/steps');
const documentsRouter = require('./routes/documents');
const insightsRouter = require('./routes/insights');
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/circles', circlesRouter);
app.use('/api/v1/medicines', medicinesRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/doctor-visits', doctorVisitsRouter);
app.use('/api/v1/expenses', expensesRouter);
app.use('/api/v1/vitals', vitalsRouter);
app.use('/api/v1/sleep', sleepRouter);
app.use('/api/v1/steps', stepsRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/insights', insightsRouter);
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing or invalid authorization header' });
  const token = authHeader.split(' ')[1];
  try {
    const jwt = require('jsonwebtoken');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    const { data: dbUser } = await supabase.from('users').select('circle_id').eq('id', req.user.id).single();
    if (dbUser && dbUser.circle_id) req.user.circle_id = dbUser.circle_id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.get('/dashboard', authenticate, async (req, res) => {
  try {
    const circle_id = req.query.circle_id || req.user.circle_id;
    if (!circle_id) return res.status(403).json({ error: 'No circle_id provided' });

    const [vitals, sleep, steps, medicines, tasks] = await Promise.all([
      supabase.from('blood_pressure_logs').select('*').eq('circle_id', circle_id).order('logged_at', { ascending: false }).limit(5),
      supabase.from('sleep_logs').select('*').eq('circle_id', circle_id).order('logged_at', { ascending: false }).limit(5),
      supabase.from('steps_logs').select('*').eq('circle_id', circle_id).order('logged_at', { ascending: false }).limit(5),
      supabase.from('medicines').select('*').eq('circle_id', circle_id).eq('is_archived', false),
      supabase.from('tasks').select('*').eq('circle_id', circle_id).eq('status', 'pending')
    ]);

    res.status(200).json({
      data: {
        vitals: vitals.data || [],
        sleep: sleep.data || [],
        steps: steps.data || [],
        medicines: medicines.data || [],
        tasks: tasks.data || []
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const runMigrations = require('./db/migrate');

const { startCron } = require('./cron/missedDoseCron');

async function startServer() {
  await runMigrations();
  
  startCron();

  app.listen(port, '0.0.0.0', () => {
    console.log(`CareCircle server listening on port ${port} (IPv4)`);
  });
}

startServer();
