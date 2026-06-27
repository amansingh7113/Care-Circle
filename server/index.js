require('dotenv').config();
const validateEnv = require('./config/envCheck');
validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = [
  'https://carecircle.in',
  'https://www.carecircle.in',
  'http://localhost:3000',
  'http://localhost:5000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation: Origin not allowed'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Initialize Supabase Client
const supabase = require('./config/supabaseClient');

const authenticate = require('./middleware/authenticate');
const { assertCircleMember } = require('./middleware/authorizer');

// Mount Routes
const authRouter = require('./routes/auth');
const circlesRouter = require('./routes/circles');
const usersRouter = require('./routes/users');
const medicinesRouter = require('./routes/medicines');
const tasksRouter = require('./routes/tasks');
const doctorVisitsRouter = require('./routes/doctorVisits');
const expensesRouter = require('./routes/expenses');
const vitalsRouter = require('./routes/vitals');
const sleepRouter = require('./routes/sleep');
const hydrationRouter = require('./routes/hydration');
const stepsRouter = require('./routes/steps');
const documentsRouter = require('./routes/documents');
const insightsRouter = require('./routes/insights');
const notificationsRouter = require('./routes/notifications');
const exportRouter = require('./routes/export');
const paymentsRouter = require('./routes/payments');
const nutritionRouter = require('./routes/nutrition');

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/circles', circlesRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/medicines', medicinesRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/doctor-visits', doctorVisitsRouter);
app.use('/api/v1/expenses', expensesRouter);
app.use('/api/v1/vitals', vitalsRouter);
app.use('/api/v1/sleep', sleepRouter);
app.use('/api/v1/hydration', hydrationRouter);
app.use('/api/v1/steps', stepsRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/insights', insightsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/export', exportRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/nutrition', nutritionRouter);

app.get('/api/v1/dashboard', authenticate, async (req, res) => {
  try {
    const circle_id = req.query.circle_id || req.user.circle_id;
    if (!circle_id) return res.status(403).json({ error: 'No circle_id provided' });

    try {
      assertCircleMember(req, circle_id);
    } catch (authErr) {
      return res.status(403).json({ error: 'Unauthorized access to this circle dashboard' });
    }

    const results = await Promise.allSettled([
      supabase.from('blood_pressure_logs').select('*').eq('circle_id', circle_id).order('logged_at', { ascending: false }).limit(5),
      supabase.from('sleep_logs').select('*').eq('circle_id', circle_id).order('logged_at', { ascending: false }).limit(5),
      supabase.from('step_logs').select('*').eq('circle_id', circle_id).order('date', { ascending: false }).limit(5),
      supabase.from('medicines').select('*').eq('circle_id', circle_id).eq('is_archived', false),
      supabase.from('tasks').select('*, assignee:users(name)').eq('circle_id', circle_id)
    ]);

    const [vitals, sleep, steps, medicines, tasks] = results.map(res => res.status === 'fulfilled' ? res.value : { data: [] });

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
const { startInsightsCron } = require('./cron/insightsProcessor');
const { startStreakCron } = require('./cron/streakCron');

async function startServer() {
  await runMigrations();
  
  startCron();
  startInsightsCron();
  startStreakCron();

  app.listen(port, '0.0.0.0', () => {
    console.log(`CareCircle server listening on port ${port} (IPv4)`);
  });
}

startServer();
