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
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/circles', circlesRouter);
app.use('/api/v1/medicines', medicinesRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/doctor-visits', doctorVisitsRouter);
app.use('/api/v1/expenses', expensesRouter);
// Dashboard Route (Placeholder)
app.get('/dashboard', async (req, res) => {
  // TODO: Implement aggregation of medicines, tasks, and visits
  res.status(200).json({
    message: 'Dashboard data (stub)',
    data: {
      medicines: [],
      tasks: [],
      visits: []
    }
  });
});

const runMigrations = require('./db/migrate');

async function startServer() {
  await runMigrations();

  app.listen(port, '0.0.0.0', () => {
    console.log(`CareCircle server listening on port ${port} (IPv4)`);
  });
}

startServer();
