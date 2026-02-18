import pg from 'pg'

const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: 'localhost', port: 5432, database: 'investissement', user: 'investissement', password: 'investissement' }
)

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS questionnaires (
      id SERIAL PRIMARY KEY,
      data JSONB NOT NULL,
      validated BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS search_prompts (
      id SERIAL PRIMARY KEY,
      prompt TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS annonces (
      id SERIAL PRIMARY KEY,
      source VARCHAR(20) NOT NULL,
      external_url TEXT NOT NULL UNIQUE,
      title TEXT,
      price INTEGER,
      surface TEXT,
      location TEXT,
      rooms TEXT,
      bedrooms TEXT,
      image_url TEXT,
      description TEXT,
      property_type TEXT,
      energy_rating TEXT,
      floor TEXT,
      charges TEXT,
      ref TEXT,
      dismissed BOOLEAN DEFAULT false,
      search_prompt_id INTEGER REFERENCES search_prompts(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      annonce_id INTEGER NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      username VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Migrations for existing databases
  const cols = ['bedrooms', 'property_type', 'energy_rating', 'floor', 'charges', 'ref']
  for (const col of cols) {
    await pool.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS ${col} TEXT`).catch(() => {})
  }
  // Migrate users table if it has old schema
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT').catch(() => {})
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT').catch(() => {})
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT').catch(() => {})
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT').catch(() => {})
  await pool.query('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL').catch(() => {})
  await pool.query('ALTER TABLE users ALTER COLUMN username DROP NOT NULL').catch(() => {})
  // Add unique constraint on google_id if missing
  await pool.query('ALTER TABLE users ADD CONSTRAINT users_google_id_unique UNIQUE (google_id)').catch(() => {})
}

export default pool
