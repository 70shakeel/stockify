import * as cheerio from 'cheerio'
import { unstable_cache } from 'next/cache'
import type { StockData } from './types'

// Rate limiter - simple in-memory throttle
const lastFetchMap = new Map<string, number>()
const THROTTLE_MS = 10_000 // 10 seconds between fetches for same ticker

function isThrottled(ticker: string): boolean {
  const last = lastFetchMap.get(ticker)
  if (!last) return false
  return Date.now() - last < THROTTLE_MS
}

function markFetched(ticker: string) {
  lastFetchMap.set(ticker, Date.now())
}

function extractNumber(text: string | undefined): number {
  if (!text) return 0
  // Remove commas first, then match the first valid number structure
  const withoutCommas = text.replace(/,/g, '')
  const match = withoutCommas.match(/[0-9]+(\.[0-9]+)?/)
  return match ? parseFloat(match[0]) : 0
}

/**
 * Main scraper function — fetches real-time PSX stock data directly
 */
export async function scrapeStockData(ticker: string, { force = false } = {}): Promise<StockData | null> {
  const normalizedTicker = ticker.toUpperCase().trim()

  if (!force && isThrottled(normalizedTicker)) {
    console.log(`Throttled: ${normalizedTicker} was fetched recently`)
    return null
  }

  markFetched(normalizedTicker)

  try {
    const url = `https://dps.psx.com.pk/company/${normalizedTicker}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      next: { revalidate: 0 },
    })

    if (!response.ok) return null

    const html = await response.text()
    const $ = cheerio.load(html)

    // Ensure page actually loaded a valid company quote
    const name = $('.quote__name').first().text().trim() || normalizedTicker
    const sector = $('.quote__sector').first().text().trim() || 'Unknown'

    const priceText = $('.quote__close').first().text().trim()
    const lastPrice = extractNumber(priceText)

    const changeContainer = $('.quote__change').first()
    const isNegativeCss = changeContainer.hasClass('change__text--neg')
    
    let change = extractNumber(changeContainer.find('.change__value').first().text())
    let changePercent = extractNumber(changeContainer.find('.change__percent').first().text())
    
    if (isNegativeCss) {
      change = -change
      changePercent = -changePercent
    }

    const volumeText = $('.company__quote .stats_label:contains("Volume")').first().next('.stats_value').text()
    const volume = parseInt(volumeText.replace(/[^0-9]/g, '')) || 0

    const dayRange = $('.company__quote .stats_label:contains("DAY RANGE")').first().next('.stats_value').find('.numRange')
    const low = extractNumber(dayRange.attr('data-low')) || lastPrice
    const high = extractNumber(dayRange.attr('data-high')) || lastPrice

    return {
      symbol: normalizedTicker,
      name,
      sector,
      lastPrice,
      change,
      changePercent: parseFloat(changePercent.toFixed(4)),
      volume,
      high,
      low,
      open: lastPrice - change, // Estimated if strictly unavailable natively
      close: lastPrice - change,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`PSX Scrape failed for ${normalizedTicker}:`, error)
    return null
  }
}

async function _fetchPSXNews(): Promise<Array<{ title: string; url: string; date: string }>> {
  try {
    const response = await fetch(
      'https://news.google.com/rss/search?q=Pakistan+Stock+Exchange+PSX&hl=en-PK&gl=PK&ceid=PK:en',
      { cache: 'no-store' }
    )

    if (!response.ok) return []

    const xml = await response.text()
    const $ = cheerio.load(xml, { xml: true })
    const items: Array<{ title: string; url: string; date: string }> = []

    $('item').each((i, el) => {
      if (i >= 10) return false
      items.push({
        title: $(el).find('title').text().trim(),
        url: $(el).find('link').text().trim(),
        date: $(el).find('pubDate').text().trim(),
      })
    })

    return items
  } catch (error) {
    console.error('Failed to scrape PSX news:', error)
    return []
  }
}

export const scrapePSXNews = unstable_cache(
  _fetchPSXNews,
  ['psx-news'],
  { revalidate: 300 }
)
