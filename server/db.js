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

  // Drop legacy tables
  await pool.query('DROP TABLE IF EXISTS questionnaires')
  await pool.query('ALTER TABLE annonces DROP COLUMN IF EXISTS search_prompt_id').catch(() => {})
  await pool.query('DROP TABLE IF EXISTS search_prompts')

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS patrimoine (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      address TEXT,
      purchase_price INTEGER,
      is_rented BOOLEAN DEFAULT false,
      monthly_rent INTEGER,
      credit_amount INTEGER,
      credit_rate NUMERIC(5,2),
      credit_duration_months INTEGER,
      group_id INTEGER REFERENCES groups(id),
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
  // Add group_id columns
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id)').catch(() => {})
  await pool.query('ALTER TABLE annonces ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id)').catch(() => {})
}

export default pool
