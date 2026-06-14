const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runMigration() {
  console.log('Using DB:', process.env.DATABASE_URL?.substring(0, 30) + '...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS step_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          step_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(circle_id, date)
      );
    `);
    
    console.log('Migration successful: Created step_logs table.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigration();
