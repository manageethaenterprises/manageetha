const { neon } = require('@neondatabase/serverless');

function getSQL() {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set. Please configure DATABASE_URL or NEON_DATABASE_URL in Vercel Project Settings.');
  }
  return neon(connectionString);
}

module.exports = { getSQL };
