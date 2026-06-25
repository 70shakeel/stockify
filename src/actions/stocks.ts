'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { scrapeStockData } from '@/lib/psx/scraper'

export async function searchStocks(query: string) {
  const supabase = await createClient()

  if (!query || query.length < 1) {
    return { data: [], error: null }
  }

  const upperQuery = query.toUpperCase()

  // 1. Try local DB first (fast)
  const { data, error } = await supabase
    .from('stocks')
    .select('symbol, name, sector, last_price, change, change_percent, volume')
    .or(`symbol.ilike.${query}%,name.ilike.${query}%`)
    .order('symbol')
    .limit(12)

  if (data && data.length > 0) {
    // Always scrape fresh prices for search results (parallel, 5s timeout)
    const priceResults = await Promise.allSettled(
      data.slice(0, 8).map((s) =>
        Promise.race([
          scrapeStockData(s.symbol, { force: true }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ])
      )
    )

    // Build a price map from scraped results
    const priceMap = new Map<string, { lastPrice: number; change: number; changePercent: number; volume: number }>()
    priceResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        const scraped = result.value
        priceMap.set(data[i].symbol, {
          lastPrice: scraped.lastPrice,
          change: scraped.change,
          changePercent: scraped.changePercent,
          volume: scraped.volume,
        })

        // Background upsert to keep DB in sync
        void (async () => {
          try {
            await supabase.from('stocks').upsert({
              symbol: scraped.symbol,
              name: scraped.name,
              sector: scraped.sector,
              last_price: scraped.lastPrice,
              change: scraped.change,
              change_percent: scraped.changePercent,
              volume: scraped.volume,
              high: scraped.high,
              low: scraped.low,
              open: scraped.open,
              close: scraped.close,
              last_updated: scraped.lastUpdated,
            }, { onConflict: 'symbol' })
          } catch (e) {
            console.error('Background upsert failed:', e)
          }
        })()
      }
    })

    // Merge live prices into results, fall back to DB price if scrape failed
    const enriched = data.map((s) => {
      const live = priceMap.get(s.symbol)
      if (live) {
        return { ...s, last_price: live.lastPrice, change: live.change, change_percent: live.changePercent, volume: live.volume }
      }
      return s
    })

    return { data: enriched, error: null }
  }

  // 2. Fallback: query live PSX symbols endpoint
  try {
    const res = await fetch('https://dps.psx.com.pk/symbols', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 }, // cache for 1 hour
    })
    if (!res.ok) return { data: [], error: null }

    const allSymbols: Array<{ symbol: string; name: string; sectorName: string }> = await res.json()

    const matches = allSymbols
      .filter(
        (s) =>
          s.symbol.toUpperCase().startsWith(upperQuery) ||
          s.name.toUpperCase().startsWith(upperQuery)
      )
      .slice(0, 8)

    if (matches.length === 0) return { data: [], error: null }

    // Fetch live prices for matched symbols in parallel (cap at 5s)
    const priceResults = await Promise.allSettled(
      matches.map((s) =>
        Promise.race([
          scrapeStockData(s.symbol),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ])
      )
    )

    // Merge prices into the matches; upsert into DB for future cache hits
    const enriched = await Promise.all(
      matches.map(async (s, i) => {
        const result = priceResults[i]
        const scraped = result.status === 'fulfilled' && result.value ? result.value : null

        if (scraped) {
          // Background upsert so future searches hit the local DB
          void (async () => {
            try {
              await supabase.from('stocks').upsert({
                symbol: scraped.symbol,
                name: scraped.name,
                sector: scraped.sector,
                last_price: scraped.lastPrice,
                change: scraped.change,
                change_percent: scraped.changePercent,
                volume: scraped.volume,
                high: scraped.high,
                low: scraped.low,
                open: scraped.open,
                close: scraped.close,
                last_updated: scraped.lastUpdated,
              }, { onConflict: 'symbol' })
            } catch (e) {
              console.error('Background upsert failed:', e)
            }
          })()
        }

        return {
          symbol: s.symbol,
          name: s.name,
          sector: s.sectorName,
          last_price: scraped?.lastPrice ?? 0,
          change: scraped?.change ?? 0,
          change_percent: scraped?.changePercent ?? 0,
          volume: scraped?.volume ?? 0,
        }
      })
    )

    return { data: enriched, error: null }
  } catch {
    return { data: [], error: error?.message || null }
  }
}

export async function getStockBySymbol(symbol: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('stocks')
    .select('*')
    .eq('symbol', symbol.toUpperCase())
    .single()

  return { data, error: error?.message || null }
}



export async function refreshPortfolioPrices(portfolioId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: holdings } = await supabase
    .from('portfolio_holdings')
    .select('symbol')
    .eq('portfolio_id', portfolioId)
    .gt('net_quantity', 0)

  const symbols = [...new Set((holdings ?? []).map((h: { symbol: string }) => h.symbol))]
  if (symbols.length === 0) return { error: null }

  await Promise.all(symbols.map(sym => refreshStockPrice(sym)))

  revalidatePath('/')
  revalidatePath('/portfolio')

  return { error: null }
}

export async function refreshStockPrice(symbol: string) {
  try {
    const supabase = await createClient()
    const normalizedTicker = symbol.toUpperCase().trim()
    
    // Scrape data directly via our high-speed DOM parser (Cheerio)
    const stockData = await scrapeStockData(normalizedTicker, { force: true })
    if (!stockData) {
       return { error: `Could not fetch data for ${normalizedTicker}` }
    }

    // Upsert into stocks cache using the current user's authenticated runtime session
    const { error: upsertError } = await supabase
      .from('stocks')
      .upsert(
        {
          symbol: stockData.symbol,
          name: stockData.name,
          sector: stockData.sector,
          last_price: stockData.lastPrice,
          change: stockData.change,
          change_percent: stockData.changePercent,
          volume: stockData.volume,
          high: stockData.high,
          low: stockData.low,
          open: stockData.open,
          close: stockData.close,
          last_updated: stockData.lastUpdated,
        },
        { onConflict: 'symbol' }
      )

    if (upsertError) {
      console.error('Failed to upsert stock cache:', upsertError)
      return { error: 'Failed to save refreshed stock data' }
    }

    return { data: stockData, error: null }
  } catch (error) {
    console.error('Refresh stock price error:', error)
    return { error: 'Failed to refresh stock price' }
  }
}

export async function seedAllPSXSymbols() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated', count: 0 }

  try {
    const res = await fetch('https://dps.psx.com.pk/symbols', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return { error: 'Failed to fetch PSX symbols', count: 0 }

    const symbols: Array<{ symbol: string; name: string; sectorName: string; isETF: boolean; isDebt: boolean }> =
      await res.json()

    // Batch into chunks of 100 to avoid Supabase payload limits
    const CHUNK = 100
    let total = 0
    for (let i = 0; i < symbols.length; i += CHUNK) {
      const chunk = symbols.slice(i, i + CHUNK).map((s) => ({
        symbol: s.symbol,
        name: s.name,
        sector: s.sectorName,
        // Leave price fields as null/0 so they get refreshed on first use
        last_price: 0,
      }))

      const { error } = await supabase
        .from('stocks')
        .upsert(chunk, { onConflict: 'symbol', ignoreDuplicates: true }) // Don't overwrite existing prices

      if (error) {
        console.error('Seed chunk error:', error)
      } else {
        total += chunk.length
      }
    }

    return { error: null, count: total }
  } catch (err) {
    console.error('Seed failed:', err)
    return { error: 'Unexpected error during seed', count: 0 }
  }
}
