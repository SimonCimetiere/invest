import express from 'express'
import cors from 'cors'
import { chromium } from 'playwright'
import pool, { initDb } from './db.js'

const app = express()
app.use(cors())
app.use(express.json())

// List all questionnaires
app.get('/api/questionnaires', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM questionnaires ORDER BY updated_at DESC'
  )
  res.json(rows)
})

// Get one questionnaire
app.get('/api/questionnaires/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM questionnaires WHERE id = $1',
    [req.params.id]
  )
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// Create a questionnaire
app.post('/api/questionnaires', async (req, res) => {
  const { data, validated } = req.body
  const { rows } = await pool.query(
    'INSERT INTO questionnaires (data, validated) VALUES ($1, $2) RETURNING *',
    [JSON.stringify(data), validated ?? false]
  )
  res.status(201).json(rows[0])
})

// Update a questionnaire
app.put('/api/questionnaires/:id', async (req, res) => {
  const { data, validated } = req.body
  const { rows } = await pool.query(
    `UPDATE questionnaires
     SET data = $1, validated = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [JSON.stringify(data), validated ?? false, req.params.id]
  )
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// Delete a questionnaire
app.delete('/api/questionnaires/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM questionnaires WHERE id = $1',
    [req.params.id]
  )
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' })
  res.status(204).end()
})

// ---- Annonces ----

// Fetch HTML via Playwright (for sites that block server-side fetch)
async function fetchWithPlaywright(url) {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      viewport: { width: 1366, height: 768 },
    })
    const page = await ctx.newPage()
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(5000)
    // Accept cookies if present
    try {
      const cookieBtn = page.locator('#didomi-notice-agree-button')
      if (await cookieBtn.isVisible({ timeout: 2000 })) {
        await cookieBtn.click()
        await page.waitForTimeout(1000)
      }
    } catch {}
    const html = await page.content()
    return html
  } finally {
    await browser.close()
  }
}

// Extract leboncoin data from __NEXT_DATA__
function extractLeboncoinFromNextData(html) {
  const nextMatch = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!nextMatch) return null

  let data
  try { data = JSON.parse(nextMatch[1]) } catch { return null }
  const ad = data?.props?.pageProps?.ad
  if (!ad) return null

  const attrs = ad.attributes || []
  function getAttr(key) {
    const a = attrs.find(a => a.key === key)
    return a?.value_label || a?.value || null
  }

  const price = Array.isArray(ad.price) ? ad.price[0] : ad.price
  const loc = ad.location || {}

  return {
    title: ad.subject || null,
    description: ad.body || null,
    image: ad.images?.urls?.[0] || (Array.isArray(ad.images) ? ad.images[0] : null),
    price: price ? parseInt(String(price), 10) : null,
    surface: getAttr('square') || null,
    location: [loc.city_label || loc.city, loc.zipcode].filter(Boolean).join(' ') || null,
    rooms: getAttr('rooms') ? getAttr('rooms') + (getAttr('rooms').includes('pièce') ? '' : ' pièces') : null,
    bedrooms: getAttr('bedrooms') ? getAttr('bedrooms') + ' chambres' : null,
    propertyType: getAttr('real_estate_type') || null,
    energyRating: getAttr('energy_rate') || getAttr('ges') || null,
    floor: getAttr('floor_number') ? getAttr('floor_number') + 'e étage' : null,
    charges: getAttr('charges_included') === 'Oui' ? 'incluses' : null,
    source: 'leboncoin',
  }
}

// Extract metadata from a URL (og tags + structured data + patterns)
async function extractMeta(url) {
  // Leboncoin: use Playwright (blocks server-side fetch)
  if (url.includes('leboncoin.fr')) {
    console.log('[meta] Using Playwright for leboncoin URL')
    const html = await fetchWithPlaywright(url)
    const lbcData = extractLeboncoinFromNextData(html)
    if (lbcData) return lbcData
    // Fallback to HTML parsing below
    return extractFromHtml(html, url)
  }

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

  let meta = { title: null, description: null, image: null, price: null, source: 'autre' }
  try {
    meta = await extractMeta(url)
    console.log(`[meta] Extracted from ${url}:`, meta.title)
  } catch (err) {
    console.error(`[meta] Failed to extract from ${url}:`, err.message)
    // Detect source even if extraction fails
    if (url.includes('leboncoin.fr')) meta.source = 'leboncoin'
    else if (url.includes('seloger.com')) meta.source = 'seloger'
  }

  const { rows } = await pool.query(
    `INSERT INTO annonces (source, external_url, title, price, surface, location, rooms, bedrooms, image_url, description, property_type, energy_rating, floor, charges)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [meta.source, url, meta.title, meta.price, meta.surface, meta.location, meta.rooms, meta.bedrooms, meta.image, meta.description, meta.propertyType, meta.energyRating, meta.floor, meta.charges]
  )
  res.status(201).json(rows[0])
})

// Add annonce manually
app.post('/api/annonces', async (req, res) => {
  const b = req.body
  const { rows } = await pool.query(
    `INSERT INTO annonces (source, external_url, title, price, surface, location, rooms, bedrooms, image_url, description, property_type, energy_rating, floor, charges)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [b.source || 'autre', b.external_url || '', b.title || null, b.price || null, b.surface || null, b.location || null, b.rooms || null, b.bedrooms || null, b.image_url || null, b.description || null, b.property_type || null, b.energy_rating || null, b.floor || null, b.charges || null]
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
     WHERE id = $12 RETURNING *`,
    [b.title, b.price, b.surface, b.location, b.rooms, b.bedrooms, b.description, b.property_type, b.energy_rating, b.floor, b.charges, req.params.id]
  )
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// List all non-dismissed annonces
app.get('/api/annonces', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM annonces WHERE dismissed = false ORDER BY created_at DESC'
  )
  res.json(rows)
})

// Dismiss an annonce
app.put('/api/annonces/:id/dismiss', async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE annonces SET dismissed = true WHERE id = $1 RETURNING *',
    [req.params.id]
  )
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// Delete an annonce
app.delete('/api/annonces/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM annonces WHERE id = $1',
    [req.params.id]
  )
  if (rowCount === 0) return res.status(404).json({ error: 'Not found' })
  res.status(204).end()
})

const PORT = 3001

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
})
