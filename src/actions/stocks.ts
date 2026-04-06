'use server'

import { createClient } from '@/lib/supabase/server'

export async function searchStocks(query: string) {
  const supabase = await createClient()

  if (!query || query.length < 1) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('stocks')
    .select('symbol, name, sector, last_price, change, change_percent, volume')
    .or(`symbol.ilike.${query}%,name.ilike.${query}%`)
    // Prioritise exact symbol prefix matches first
    .order('symbol')
    .limit(12)

  return { data: data || [], error: error?.message || null }
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

import { scrapeStockData } from '@/lib/psx/scraper'

export async function refreshStockPrice(symbol: string) {
  try {
    const supabase = await createClient()
    const normalizedTicker = symbol.toUpperCase().trim()
    
    // Scrape data directly via our high-speed DOM parser (Cheerio)
    const stockData = await scrapeStockData(normalizedTicker)
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
