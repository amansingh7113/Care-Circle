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
    
    // Add scheduled_time column to medicine_dose_logs
    await client.query(`
      ALTER TABLE medicine_dose_logs 
      ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(10);
    `);
    
    console.log('Migration successful: Added scheduled_time column.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigration();
