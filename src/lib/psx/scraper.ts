import * as cheerio from 'cheerio'
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

/**
 * Scrape stock data using TinyFish AI agent
 */
async function scrapeWithTinyFish(ticker: string): Promise<StockData | null> {
  const apiKey = process.env.TINYFISH_API_KEY
  if (!apiKey) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TinyFish, EventType, RunStatus } = await import('@tiny-fish/sdk')
    const client = new TinyFish({ apiKey })

    const result = await client.agent.run({
      url: `https://dps.psx.com.pk/company/${ticker}`,
      goal: `Extract the following stock data for ${ticker} as JSON: symbol, name, sector, lastPrice (current market price), change (price change today), changePercent (percentage change), volume (today's trading volume), high (today's high), low (today's low), open (today's open), close (yesterday's close). Return numbers as actual numbers, not strings.`,
    })

    if (result && result.result) {
      const data = result.result as Record<string, unknown>
      return {
        symbol: String(data.symbol || ticker).toUpperCase(),
        name: String(data.name || ticker),
        sector: String(data.sector || 'Unknown'),
        lastPrice: Number(data.lastPrice) || 0,
        change: Number(data.change) || 0,
        changePercent: Number(data.changePercent) || 0,
        volume: Number(data.volume) || 0,
        high: Number(data.high) || 0,
        low: Number(data.low) || 0,
        open: Number(data.open) || 0,
        close: Number(data.close) || 0,
        lastUpdated: new Date().toISOString(),
      }
    }
    return null
  } catch (error) {
    console.error(`TinyFish scrape failed for ${ticker}:`, error)
    return null
  }
}

/**
 * Fallback: Scrape stock data using Cheerio from PSX website
 */
async function scrapeWithCheerio(ticker: string): Promise<StockData | null> {
  try {
    const url = `https://dps.psx.com.pk/company/${ticker}`
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

    // Parse data from the PSX company page
    const name = $('h1.company-name, .quote__name, h1').first().text().trim() || ticker
    const sector = $('.sector-name, .quote__sector').first().text().trim() || 'Unknown'

    // Try to extract price data from various possible selectors
    const priceText = $('.quote__close, .current-price, .price').first().text().trim()
    const changeText = $('.quote__change, .price-change').first().text().trim()
    const volumeText = $('.quote__volume, .volume').first().text().trim()
    const highText = $('.quote__high, .day-high').first().text().trim()
    const lowText = $('.quote__low, .day-low').first().text().trim()
    const openText = $('.quote__open, .day-open').first().text().trim()

    const lastPrice = parseFloat(priceText.replace(/[^0-9.-]/g, '')) || 0
    const change = parseFloat(changeText.replace(/[^0-9.-]/g, '')) || 0
    const changePercent = lastPrice > 0 ? (change / (lastPrice - change)) * 100 : 0

    return {
      symbol: ticker.toUpperCase(),
      name,
      sector,
      lastPrice,
      change,
      changePercent: parseFloat(changePercent.toFixed(4)),
      volume: parseInt(volumeText.replace(/[^0-9]/g, '')) || 0,
      high: parseFloat(highText.replace(/[^0-9.-]/g, '')) || lastPrice,
      low: parseFloat(lowText.replace(/[^0-9.-]/g, '')) || lastPrice,
      open: parseFloat(openText.replace(/[^0-9.-]/g, '')) || lastPrice,
      close: lastPrice - change,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`Cheerio scrape failed for ${ticker}:`, error)
    return null
  }
}

/**
 * Main scraper function — tries TinyFish first, falls back to Cheerio
 */
export async function scrapeStockData(ticker: string): Promise<StockData | null> {
  const normalizedTicker = ticker.toUpperCase().trim()

  if (isThrottled(normalizedTicker)) {
    console.log(`Throttled: ${normalizedTicker} was fetched recently`)
    return null
  }

  markFetched(normalizedTicker)

  // Try TinyFish first
  let data = await scrapeWithTinyFish(normalizedTicker)

  // Fallback to Cheerio
  if (!data) {
    data = await scrapeWithCheerio(normalizedTicker)
  }

  return data
}

/**
 * Scrape PSX news headlines
 */
export async function scrapePSXNews(): Promise<Array<{ title: string; url: string; date: string }>> {
  try {
    // Use Google News RSS as a reliable source
    const response = await fetch(
      'https://news.google.com/rss/search?q=Pakistan+Stock+Exchange+PSX&hl=en-PK&gl=PK&ceid=PK:en',
      { next: { revalidate: 300 } } // Cache for 5 minutes
    )

    if (!response.ok) return []

    const xml = await response.text()
    const $ = cheerio.load(xml, { xml: true })
    const items: Array<{ title: string; url: string; date: string }> = []

    $('item').each((i, el) => {
      if (i >= 10) return false // Limit to 10 items
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
