import { chromium } from 'playwright'

export async function scrapeLeboncoin(prompt) {
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
    const searchUrl = `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(prompt)}&category=10`
    console.log(`[leboncoin] Navigating to: ${searchUrl}`)

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Wait for content to render
    await page.waitForTimeout(3000)

    // Accept cookies if modal appears
    try {
      const cookieBtn = page.locator('button#didomi-notice-agree-button')
      if (await cookieBtn.isVisible({ timeout: 2000 })) {
        await cookieBtn.click()
        await page.waitForTimeout(1000)
      }
    } catch {
      // No cookie banner
    }

    await page.waitForTimeout(2000)

    // Try to extract listings - leboncoin uses data attributes and various class patterns
    const listings = await page.evaluate(() => {
      const items = []

      // Look for listing links - leboncoin typically wraps each ad in an anchor tag
      const adElements = document.querySelectorAll('[data-qa-id="aditem_container"], a[href*="/ad/"]')

      for (const el of adElements) {
        try {
          const anchor = el.tagName === 'A' ? el : el.querySelector('a')
          if (!anchor) continue

          const href = anchor.getAttribute('href')
          if (!href || !href.includes('/ad/')) continue

          const url = href.startsWith('http') ? href : `https://www.leboncoin.fr${href}`

          // Extract text content
          const titleEl = el.querySelector('[data-qa-id="aditem_title"], h2, p[data-test-id="ad-title"]')
          const title = titleEl?.textContent?.trim() || ''

          const priceEl = el.querySelector('[data-qa-id="aditem_price"], span[data-test-id="ad-price"]')
          const priceText = priceEl?.textContent?.trim() || ''
          const price = parseInt(priceText.replace(/[^\d]/g, ''), 10) || null

          const locationEl = el.querySelector('[data-qa-id="aditem_location"], p[data-test-id="ad-location"]')
          const location = locationEl?.textContent?.trim() || ''

          const img = el.querySelector('img')
          const imageUrl = img?.src || img?.getAttribute('data-src') || ''

          // Extract surface/rooms from tags or description
          const tags = Array.from(el.querySelectorAll('[data-qa-id="aditem_tags"] span, [data-test-id="ad-params"] span'))
          let surface = ''
          let rooms = ''
          for (const tag of tags) {
            const text = tag.textContent.trim()
            if (text.includes('m²')) surface = text
            if (text.includes('pièce') || text.includes('chambre')) rooms = text
          }

          if (title || url) {
            items.push({ url, title, price, location, surface, rooms, imageUrl })
          }
        } catch {
          // Skip this element
        }
      }

      return items
    })

    for (const listing of listings) {
      results.push({
        source: 'leboncoin',
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

    console.log(`[leboncoin] Found ${results.length} listings`)
  } catch (err) {
    console.error('[leboncoin] Scraping error:', err.message)
  } finally {
    await browser.close()
  }

  return results
}
