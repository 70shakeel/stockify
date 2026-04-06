'use server'

import { createClient } from '@/lib/supabase/server'

export async function searchStocks(query: string) {
  const supabase = await createClient()

  if (!query || query.length < 1) {
    // Return all stocks sorted by symbol
    const { data, error } = await supabase
      .from('stocks')
      .select('symbol, name, sector, last_price, change, change_percent, volume')
      .order('symbol')
      .limit(50)

    return { data: data || [], error: error?.message || null }
  }

  const { data, error } = await supabase
    .from('stocks')
    .select('symbol, name, sector, last_price, change, change_percent, volume')
    .or(`symbol.ilike.%${query}%,name.ilike.%${query}%,sector.ilike.%${query}%`)
    .order('symbol')
    .limit(20)

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
