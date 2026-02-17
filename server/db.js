import pg from 'pg'

const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: 'localhost', port: 5432, database: 'investissement', user: 'investissement', password: 'investissement' }
)

export async function initDb() {
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
  // Add missing columns to existing tables
  const newCols = ['bedrooms', 'property_type', 'energy_rating', 'floor', 'charges', 'ref']
  for (const col of newCols) {
    await pool.query(`ALTER TABLE annonces ADD COLUMN IF NOT EXISTS ${col} TEXT`).catch(() => {})
  }
}

export default pool
