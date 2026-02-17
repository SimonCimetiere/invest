import pg from 'pg'
import bcrypt from 'bcryptjs'

const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: 'localhost', port: 5432, database: 'investissement', user: 'investissement', password: 'investissement' }
)

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Seed users if table is empty
  const { rows: existingUsers } = await pool.query('SELECT COUNT(*) FROM users')
  if (parseInt(existingUsers[0].count, 10) === 0) {
    const users = [
      { name: process.env.USER1_NAME || 'simon', pass: process.env.USER1_PASS || 'simon123' },
      { name: process.env.USER2_NAME || 'ami', pass: process.env.USER2_PASS || 'ami123' },
    ]
    for (const u of users) {
      const hash = await bcrypt.hash(u.pass, 10)
      await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [u.name, hash])
    }
    console.log('Seeded 2 users:', users.map(u => u.name).join(', '))
  }

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
