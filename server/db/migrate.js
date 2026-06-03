const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL is not set. Skipping auto-migrations.');
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('📦 Connected to database for migrations.');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [file]
      );

      if (rows.length === 0) {
        console.log(`🚀 Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (version) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          console.log(`✅ Migration applied: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`❌ Migration failed: ${file}`);
          throw err;
        }
      }
    }
    
    console.log('✨ All migrations are up to date.');
  } catch (error) {
    console.error('❌ Error running migrations:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

module.exports = runMigrations;
