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

export async function refreshStockPrice(symbol: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/psx/${symbol}`,
      { cache: 'no-store' }
    )

    if (!response.ok) {
      return { error: 'Failed to refresh stock price' }
    }

    const result = await response.json()
    return { data: result.data, error: null }
  } catch (error) {
    console.error('Refresh stock price error:', error)
    return { error: 'Failed to refresh stock price' }
  }
}
