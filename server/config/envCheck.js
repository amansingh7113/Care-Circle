const validateEnv = () => {
  const requiredKeys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'PORT'
  ];

  const missingKeys = [];

  for (const key of requiredKeys) {
    if (!process.env[key]) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    console.error(`Initialization Error: Missing required environment variables: ${missingKeys.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL.startsWith('https://')) {
    console.error('Initialization Error: SUPABASE_URL must begin with https://');
    process.exit(1);
  }
};

module.exports = validateEnv;
