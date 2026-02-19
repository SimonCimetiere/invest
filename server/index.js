import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import pool, { initDb } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

const app = express()
app.use(cors())
app.use(express.json())

function makeToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url, group_id: user.group_id || null },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// ---- Auth ----

// Google Client ID (needed by frontend)
app.get('/api/auth/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null })
})

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body
    if (!credential) return res.status(400).json({ error: 'credential is required' })
    if (!googleClient) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' })

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    const { sub: googleId, email, name, picture } = payload

    // Upsert user
    const { rows } = await pool.query(
      `INSERT INTO users (google_id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE SET email = $2, name = $3, avatar_url = $4
       RETURNING *`,
      [googleId, email, name || email, picture || null]
    )
    const user = rows[0]

    const token = makeToken(user)
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url, group_id: user.group_id || null } })
  } catch (err) {
    console.error('Google auth error:', err.message || err)
    if (err.message?.includes('CONFLICT') || err.message?.includes('duplicate') || err.code === '23505') {
      res.status(500).json({ error: 'Erreur base de donnees: ' + err.message })
    } else {
      res.status(401).json({ error: 'Token Google invalide: ' + (err.message || 'erreur inconnue') })
    }
  }
})

// Auth middleware for all other /api routes
app.use('/api', (req, res, next) => {
  // Skip auth for public routes
  if (req.path === '/auth/google' || req.path === '/auth/config') return next()

  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Token manquant' })

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalide' })
  }
})

// ---- Groups ----

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// Get current user's group
app.get('/api/groups/mine', async (req, res) => {
  if (!req.user.group_id) return res.json(null)
  const { rows } = await pool.query('SELECT * FROM groups WHERE id = $1', [req.user.group_id])
  res.json(rows[0] || null)
})

// Create a group
app.post('/api/groups', async (req, res) => {
  const { name } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' })

  let invite_code
  for (let i = 0; i < 10; i++) {
    invite_code = generateInviteCode()
    const exists = await pool.query('SELECT id FROM groups WHERE invite_code = $1', [invite_code])
    if (exists.rows.length === 0) break
  }

  const { rows } = await pool.query(
    'INSERT INTO groups (name, invite_code, owner_id) VALUES ($1, $2, $3) RETURNING *',
    [name.trim(), invite_code, req.user.id]
  )
  const group = rows[0]

  await pool.query('UPDATE users SET group_id = $1 WHERE id = $2', [group.id, req.user.id])

  const userRow = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id])
  const token = makeToken(userRow.rows[0])
  res.status(201).json({ group, token })
})

// Join a group by invite code
app.post('/api/groups/join', async (req, res) => {
  const { code } = req.body
  if (!code || !code.trim()) return res.status(400).json({ error: 'Code requis' })

  const { rows } = await pool.query('SELECT * FROM groups WHERE invite_code = $1', [code.trim().toUpperCase()])
  if (rows.length === 0) return res.status(404).json({ error: 'Code de groupe invalide' })

  const group = rows[0]
  await pool.query('UPDATE users SET group_id = $1 WHERE id = $2', [group.id, req.user.id])

  const userRow = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id])
  const token = makeToken(userRow.rows[0])
  res.json({ group, token })
})

// List members of the current user's group
app.get('/api/groups/members', async (req, res) => {
  if (!req.user.group_id) return res.status(403).json({ error: 'Vous devez rejoindre un groupe' })
  const { rows } = await pool.query(
    'SELECT id, name, email, avatar_url, created_at FROM users WHERE group_id = $1 ORDER BY created_at ASC',
    [req.user.group_id]
  )
  // Check if current user is the group owner
  const group = await pool.query('SELECT owner_id FROM groups WHERE id = $1', [req.user.group_id])
  const owner_id = group.rows[0]?.owner_id || null
  res.json({ members: rows, owner_id })
})

// Remove a member from the group (admin only)
app.delete('/api/groups/members/:userId', async (req, res) => {
  if (!req.user.group_id) return res.status(403).json({ error: 'Vous devez rejoindre un groupe' })
  const group = await pool.query('SELECT owner_id FROM groups WHERE id = $1', [req.user.group_id])
  if (group.rows[0]?.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Seul l\'administrateur peut retirer des membres' })
  }
  const targetId = parseInt(req.params.userId, 10)
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas vous retirer vous-meme' })
  }
  const target = await pool.query('SELECT id FROM users WHERE id = $1 AND group_id = $2', [targetId, req.user.group_id])
  if (target.rows.length === 0) return res.status(404).json({ error: 'Membre introuvable' })
  await pool.query('UPDATE users SET group_id = NULL WHERE id = $1', [targetId])
  res.json({ ok: true })
})

// Reset invite code (admin only)
app.post('/api/groups/reset-invite', async (req, res) => {
  if (!req.user.group_id) return res.status(403).json({ error: 'Vous devez rejoindre un groupe' })
  const group = await pool.query('SELECT owner_id FROM groups WHERE id = $1', [req.user.group_id])
  if (group.rows[0]?.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Seul l\'administrateur peut reinitialiser le code' })
  }
  let invite_code
  for (let i = 0; i < 10; i++) {
    invite_code = generateInviteCode()
    const exists = await pool.query('SELECT id FROM groups WHERE invite_code = $1', [invite_code])
    if (exists.rows.length === 0) break
  }
  const { rows } = await pool.query(
    'UPDATE groups SET invite_code = $1 WHERE id = $2 RETURNING *',
    [invite_code, req.user.group_id]
  )
  res.json(rows[0])
})

// Middleware: require group_id for all data routes below
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path.startsWith('/groups')) return next()
  if (!req.user.group_id) return res.status(403).json({ error: 'Vous devez rejoindre un groupe' })
  next()
})

// ---- Annonces ----

// Extract metadata from a URL (og tags + structured data + patterns)
async function extractMeta(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  const html = await res.text()

  // Detect captcha/anti-bot pages (DataDome returns captcha-delivery scripts, or very short HTML with 403)
  if (html.includes('captcha-delivery.com') || html.includes('geo.captcha-delivery') || html.includes('Please enable JS and disable any ad blocker') || (res.status === 403 && html.length < 5000)) {
    console.log(`[meta] Captcha detected for ${url}`)
    let source = 'autre'
    if (url.includes('leboncoin.fr')) source = 'leboncoin'
    else if (url.includes('seloger.com')) source = 'seloger'
    return { title: null, description: null, image: null, price: null, surface: null, location: null, rooms: null, bedrooms: null, propertyType: null, energyRating: null, floor: null, charges: null, source, blocked: true }
  }

  return extractFromHtml(html, url)
}

function extractFromHtml(html, url) {

  function getOg(property) {
    const re = new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, 'i')
    const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, 'i')
    return (html.match(re) || html.match(alt))?.[1]?.replace(/&amp;/g, '&') || null
  }

  function getMeta(name) {
    const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
    const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i')
    return (html.match(re) || html.match(alt))?.[1]?.replace(/&amp;/g, '&') || null
  }

  // Try JSON-LD structured data first (richest source)
  let jsonLd = null
  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const m of jsonLdMatches) {
    try {
      const parsed = JSON.parse(m[1])
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item['@type'] === 'Product' || item['@type'] === 'RealEstateListing' ||
            item['@type'] === 'Residence' || item['@type'] === 'Apartment' ||
            item['@type'] === 'House' || item['@type'] === 'SingleFamilyResidence' ||
            item['@type'] === 'Offer') {
          jsonLd = item
          break
        }
      }
    } catch {}
  }

  const title = jsonLd?.name || getOg('title') || html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || null
  const description = jsonLd?.description || getOg('description') || getMeta('description') || null
  const image = jsonLd?.image?.url || jsonLd?.image || getOg('image') || null

  // Price
  let price = null
  if (jsonLd?.offers?.price) price = parseInt(jsonLd.offers.price, 10)
  if (!price && jsonLd?.price) price = parseInt(String(jsonLd.price).replace(/[^\d]/g, ''), 10)
  if (!price) {
    const priceOg = getOg('price:amount')
    if (priceOg) price = parseInt(priceOg, 10)
  }
  if (!price) {
    const priceMatch = html.match(/(\d[\d\s\u00a0.,]{2,})\s*€/m)
    if (priceMatch) price = parseInt(priceMatch[1].replace(/[\s\u00a0.,]/g, ''), 10) || null
  }

  // Surface
  let surface = null
  const surfaceMatch = description?.match(/(\d+[\d,]*)\s*m[²2]/i) || html.match(/(\d+[\d,]*)\s*m[²2]/i)
  if (surfaceMatch) surface = surfaceMatch[1].replace(',', '.') + ' m²'

  // Rooms / Bedrooms
  let rooms = null
  let bedrooms = null
  const roomsMatch = description?.match(/(\d+)\s*pi[eè]ce/i) || html.match(/(\d+)\s*pi[eè]ce/i)
  if (roomsMatch) rooms = roomsMatch[1] + ' pièces'
  const bedroomsMatch = description?.match(/(\d+)\s*chambre/i) || html.match(/(\d+)\s*chambre/i)
  if (bedroomsMatch) bedrooms = bedroomsMatch[1] + ' chambres'

  // Location
  let location = getOg('locality') || getOg('region') || null
  if (!location && jsonLd?.address) {
    const addr = jsonLd.address
    location = typeof addr === 'string' ? addr : [addr.addressLocality, addr.postalCode].filter(Boolean).join(' ')
  }
  if (!location) {
    // Try to find city/postal code patterns in title or description
    const locMatch = (title || '')?.match(/(?:à|a)\s+([A-ZÀ-Ü][a-zà-ü\-]+(?:\s[A-ZÀ-Ü][a-zà-ü\-]+)*)/u)
    if (locMatch) location = locMatch[1]
  }

  // Property type
  let propertyType = null
  const typePatterns = ['appartement', 'maison', 'immeuble', 'studio', 'loft', 'duplex', 'triplex', 'terrain', 'local commercial', 'parking', 'garage']
  const lowerTitle = (title || '').toLowerCase()
  const lowerDesc = (description || '').toLowerCase()
  for (const t of typePatterns) {
    if (lowerTitle.includes(t) || lowerDesc.includes(t)) { propertyType = t.charAt(0).toUpperCase() + t.slice(1); break }
  }

  // Energy rating (DPE)
  let energyRating = null
  const dpeMatch = html.match(/DPE\s*[:\s]*([A-G])/i) || description?.match(/DPE\s*[:\s]*([A-G])/i)
  if (dpeMatch) energyRating = dpeMatch[1].toUpperCase()

  // Floor
  let floor = null
  const floorMatch = description?.match(/(\d+)[eè](?:me)?\s*étage/i) || html.match(/(\d+)[eè](?:me)?\s*étage/i)
  if (floorMatch) floor = floorMatch[1] + 'e étage'
  const rdc = description?.match(/rez[\s-]*de[\s-]*chauss[ée]/i)
  if (rdc) floor = 'RDC'

  // Charges
  let charges = null
  const chargesMatch = description?.match(/charges?\s*[:\s]*(\d+[\d\s.,]*)\s*€/i)
  if (chargesMatch) charges = chargesMatch[1].trim() + ' €/mois'

  // Detect source
  let source = 'autre'
  if (url.includes('leboncoin.fr')) source = 'leboncoin'
  else if (url.includes('seloger.com')) source = 'seloger'

  return { title, description, image, price, surface, location, rooms, bedrooms, propertyType, energyRating, floor, charges, source }
}

// Add annonce from URL (with metadata extraction)
app.post('/api/annonces/from-url', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'url is required' })

  // Check for duplicate
  const existing = await pool.query('SELECT * FROM annonces WHERE external_url = $1', [url])
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Cette annonce existe déjà', annonce: existing.rows[0] })
  }

  // These sites block server-side fetch (captcha, SPA, anti-bot)
  const BLOCKED_SITES = ['leboncoin.fr', 'seloger.com']
  const isBlockedSite = BLOCKED_SITES.some(s => url.includes(s))

  let meta = { title: null, description: null, image: null, price: null, source: 'autre' }
  let blocked = isBlockedSite

  if (isBlockedSite) {
    // Skip extraction, just detect source
    if (url.includes('leboncoin.fr')) meta.source = 'leboncoin'
    else if (url.includes('seloger.com')) meta.source = 'seloger'
    console.log(`[meta] Skipping extraction for blocked site: ${meta.source}`)
  } else {
    try {
      meta = await extractMeta(url)
      blocked = !!meta.blocked
      console.log(`[meta] Extracted from ${url}:`, meta.title)
    } catch (err) {
      console.error(`[meta] Failed to extract from ${url}:`, err.message)
      blocked = true
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO annonces (source, external_url, title, price, surface, location, rooms, bedrooms, image_url, description, property_type, energy_rating, floor, charges, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
    [meta.source, url, meta.title, meta.price, meta.surface, meta.location, meta.rooms, meta.bedrooms, meta.image, meta.description, meta.propertyType, meta.energyRating, meta.floor, meta.charges, req.user.group_id]
  )
  const annonce = rows[0]
  if (blocked) annonce.extraction_blocked = true
  res.status(201).json(annonce)
})

// Add annonce manually
app.post('/api/annonces', async (req, res) => {
  const b = req.body
  const { rows } = await pool.query(
    `INSERT INTO annonces (source, external_url, title, price, surface, location, rooms, bedrooms, image_url, description, property_type, energy_rating, floor, charges, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
    [b.source || 'autre', b.external_url || '', b.title || null, b.price || null, b.surface || null, b.location || null, b.rooms || null, b.bedrooms || null, b.image_url || null, b.description || null, b.property_type || null, b.energy_rating || null, b.floor || null, b.charges || null, req.user.group_id]
  )
  res.status(201).json(rows[0])
})

// Update annonce
app.put('/api/annonces/:id', async (req, res) => {
  const b = req.body
  const { rows } = await pool.query(
    `UPDATE annonces SET
     title = COALESCE($1, title), price = COALESCE($2, price),
     surface = COALESCE($3, surface), location = COALESCE($4, location),
     rooms = COALESCE($5, rooms), bedrooms = COALESCE($6, bedrooms),
     description = COALESCE($7, description), property_type = COALESCE($8, property_type),
     energy_rating = COALESCE($9, energy_rating), floor = COALESCE($10, floor),
     charges = COALESCE($11, charges)
     WHERE id = $12 AND group_id = $13 RETURNING *`,
    [b.title, b.price, b.surface, b.location, b.rooms, b.bedrooms, b.description, b.property_type, b.energy_rating, b.floor, b.charges, req.params.id, req.user.group_id]
  )
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// List all non-dismissed annonces
app.get('/api/annonces', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM annonces WHERE dismissed = false AND group_id = $1 ORDER BY created_at DESC',
    [req.user.group_id]
  )
  res.json(rows)
})

// Dismiss an annonce
app.put('/api/annonces/:id/dismiss', async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE annonces SET dismissed = true WHERE id = $1 AND group_id = $2 RETURNING *',
    [req.params.id, req.user.group_id]
  )
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// Delete an annonce
app.delete('/api/annonces/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM annonces WHERE id = $1 AND group_id = $2',
    [req.params.id, req.user.group_id]
  )
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' })
  res.status(204).end()
})

// ---- Comments ----

// Get comment counts for all annonces
app.get('/api/comments/counts', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT annonce_id, COUNT(*)::int AS count FROM comments GROUP BY annonce_id'
  )
  const counts = {}
  rows.forEach(r => { counts[r.annonce_id] = r.count })
  res.json(counts)
})

// List comments for an annonce
app.get('/api/annonces/:id/comments', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM comments WHERE annonce_id = $1 ORDER BY created_at ASC',
    [req.params.id]
  )
  res.json(rows)
})

// Add a comment
app.post('/api/annonces/:id/comments', async (req, res) => {
  const { content } = req.body
  if (!content || !content.trim()) return res.status(400).json({ error: 'Contenu requis' })
  const { rows } = await pool.query(
    'INSERT INTO comments (annonce_id, user_id, username, content) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.params.id, req.user.id, req.user.name, content.trim()]
  )
  res.status(201).json(rows[0])
})

// Delete a comment (only by its author)
app.delete('/api/comments/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM comments WHERE id = $1', [req.params.id])
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
  if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Non autorise' })
  await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id])
  res.status(204).end()
})

// ---- Patrimoine ----

// List all patrimoine for the group
app.get('/api/patrimoine', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM patrimoine WHERE group_id = $1 ORDER BY created_at DESC',
    [req.user.group_id]
  )
  res.json(rows)
})

// Add a patrimoine
app.post('/api/patrimoine', async (req, res) => {
  const b = req.body
  if (!b.title || !b.title.trim()) return res.status(400).json({ error: 'Titre requis' })
  const { rows } = await pool.query(
    `INSERT INTO patrimoine (title, address, purchase_price, is_rented, monthly_rent, credit_amount, credit_rate, credit_duration_months, lease_start_date, lease_duration_months, group_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [b.title.trim(), b.address || null, b.purchase_price || null, b.is_rented || false, b.monthly_rent || null, b.credit_amount || null, b.credit_rate || null, b.credit_duration_months || null, b.lease_start_date || null, b.lease_duration_months || null, req.user.group_id]
  )
  res.status(201).json(rows[0])
})

// Update a patrimoine
app.put('/api/patrimoine/:id', async (req, res) => {
  const b = req.body
  const { rows } = await pool.query(
    `UPDATE patrimoine SET
     title = COALESCE($1, title), address = COALESCE($2, address),
     purchase_price = $3, is_rented = $4, monthly_rent = $5,
     credit_amount = $6, credit_rate = $7, credit_duration_months = $8,
     lease_start_date = $9, lease_duration_months = $10
     WHERE id = $11 AND group_id = $12 RETURNING *`,
    [b.title, b.address, b.purchase_price || null, b.is_rented || false, b.monthly_rent || null, b.credit_amount || null, b.credit_rate || null, b.credit_duration_months || null, b.lease_start_date || null, b.lease_duration_months || null, req.params.id, req.user.group_id]
  )
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// Delete a patrimoine
app.delete('/api/patrimoine/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM patrimoine WHERE id = $1 AND group_id = $2',
    [req.params.id, req.user.group_id]
  )
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' })
  res.status(204).end()
})

// JSON error handler for API routes
app.use('/api', (err, req, res, next) => {
  console.error('API error:', err)
  res.status(500).json({ error: 'Erreur serveur' })
})

// Serve static files in production
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'))
  } else {
    next()
  }
})

const PORT = process.env.PORT || 3001

initDb()
  .then(() => console.log('Database initialized'))
  .catch(err => console.error('Database init failed:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  })
