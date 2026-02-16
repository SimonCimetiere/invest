import { chromium } from 'playwright'

export async function scrapeSeloger(prompt) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'fr-FR',
  })

  const page = await context.newPage()
  const results = []

  try {
    const searchUrl = `https://www.seloger.com/list.htm?projects=2&types=2,1&qsVersion=1.0&text=${encodeURIComponent(prompt)}`
    console.log(`[seloger] Navigating to: ${searchUrl}`)

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Accept cookies if present
    try {
      const cookieBtn = page.locator('#didomi-notice-agree-button, button[id*="accept"]')
      if (await cookieBtn.first().isVisible({ timeout: 2000 })) {
        await cookieBtn.first().click()
        await page.waitForTimeout(1000)
      }
    } catch {
      // No cookie banner
    }

    await page.waitForTimeout(2000)

    // Try to extract from embedded JSON data first (more reliable)
    const jsonResults = await page.evaluate(() => {
      try {
        // SeLoger often embeds data in window.__INITIAL_STATE__ or script tags
        const scripts = document.querySelectorAll('script')
        for (const script of scripts) {
          const content = script.textContent
          if (content.includes('initialData') || content.includes('cards')) {
            const match = content.match(/window\["initialData"\]\s*=\s*JSON\.parse\("(.+?)"\)/)
            if (match) {
              const decoded = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
              return JSON.parse(decoded)
            }
          }
        }
      } catch {
        // Fall through to DOM parsing
      }
      return null
    })

    if (jsonResults?.cards?.list) {
      for (const card of jsonResults.cards.list) {
        if (card.classifiedURL) {
          results.push({
            source: 'seloger',
            external_url: card.classifiedURL,
            title: card.title || null,
            price: card.pricing?.price || null,
            surface: card.tags?.find(t => t.includes('m²')) || null,
            location: card.cityLabel || card.districtLabel || null,
            rooms: card.tags?.find(t => t.includes('pièce') || t.includes('ch')) || null,
            image_url: card.photos?.[0] || null,
            description: card.description || null,
          })
        }
      }
    }

    // Fallback: DOM-based extraction
    if (results.length === 0) {
      const listings = await page.evaluate(() => {
        const items = []
        // SeLoger uses card-based layout
        const cards = document.querySelectorAll('[data-testid="sl.explore.card-container"], article, [class*="CardContainer"], [class*="listing"]')

        for (const card of cards) {
          try {
            const anchor = card.querySelector('a[href*="annonces"]')
            if (!anchor) continue

            const href = anchor.getAttribute('href')
            const url = href?.startsWith('http') ? href : `https://www.seloger.com${href}`

            const titleEl = card.querySelector('[data-testid="sl.explore.card-title"], h2, [class*="Title"]')
            const title = titleEl?.textContent?.trim() || ''

            const priceEl = card.querySelector('[data-testid="sl.explore.card-price"], [class*="Price"]')
            const priceText = priceEl?.textContent?.trim() || ''
            const price = parseInt(priceText.replace(/[^\d]/g, ''), 10) || null

            const locationEl = card.querySelector('[data-testid="sl.explore.card-city"], [class*="City"], [class*="Location"]')
            const location = locationEl?.textContent?.trim() || ''

            const img = card.querySelector('img')
            const imageUrl = img?.src || ''

            const tags = Array.from(card.querySelectorAll('[class*="Tag"], [class*="Criteria"] span'))
            let surface = ''
            let rooms = ''
            for (const tag of tags) {
              const text = tag.textContent.trim()
              if (text.includes('m²')) surface = text
              if (text.includes('p') || text.includes('ch')) rooms = text
            }

            if (title || url) {
              items.push({ url, title, price, location, surface, rooms, imageUrl })
            }
          } catch {
            // Skip
          }
        }
        return items
      })

      for (const listing of listings) {
        results.push({
          source: 'seloger',
          external_url: listing.url,
          title: listing.title || null,
          price: listing.price || null,
          surface: listing.surface || null,
          location: listing.location || null,
          rooms: listing.rooms || null,
          image_url: listing.imageUrl || null,
          description: null,
        })
      }
    }

    console.log(`[seloger] Found ${results.length} listings`)
  } catch (err) {
    console.error('[seloger] Scraping error:', err.message)
  } finally {
    await browser.close()
  }

  return results
}
