'use server'

import { createClient } from '@/lib/supabase/server'
import type { PortfolioHolding, PortfolioSummaryData } from '@/lib/psx/types'

import { refreshStockPrice } from '@/actions/stocks'

async function ensureFreshPrices(supabase: any, symbols: string[]) {
  if (!symbols.length) return false

  // Get raw stock cache entries to check their last_updated timestamps
  const { data: stocks } = await supabase
    .from('stocks')
    .select('symbol, last_price, last_updated')
    .in('symbol', symbols)

  if (!stocks) return false

  const now = Date.now()
  const STALE_MS = 15 * 60 * 1000 // 15 minutes

  // Find stocks that are either price=0 OR haven't been updated in 15 minutes
  const missingOrStale = stocks
    .filter((s: any) => {
      if (Number(s.last_price) === 0) return true
      if (!s.last_updated) return true
      const age = now - new Date(s.last_updated).getTime()
      return age > STALE_MS
    })
    .map((s: any) => s.symbol)

  if (missingOrStale.length > 0) {
    // Refresh all stale stocks
    await Promise.all(missingOrStale.map((sym: string) => refreshStockPrice(sym)))
    return true // Returns true if a refresh occurred so the caller knows to refetch the view
  }

  return false
}

export async function getPortfolioHoldings(): Promise<{
  data: PortfolioHolding[]
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('portfolio_holdings')
    .select('*')
    .eq('user_id', user.id)
    .gt('net_quantity', 0) // Only show active holdings
    .order('current_value', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  const holdings = (data as PortfolioHolding[]) || []
  const symbols = holdings.map(h => h.symbol)

  const wasRefreshed = await ensureFreshPrices(supabase, symbols)

  if (wasRefreshed) {
    const { data: refreshedData, error: refreshedError } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', user.id)
      .gt('net_quantity', 0)
      .order('current_value', { ascending: false })

    if (!refreshedError) {
      return { data: (refreshedData as PortfolioHolding[]) || [], error: null }
    }
  }

  return { data: holdings, error: null }
}

export async function getPortfolioSummary(): Promise<{
  data: PortfolioSummaryData | null
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  const { data: holdings, error } = await supabase
    .from('portfolio_holdings')
    .select('*')
    .eq('user_id', user.id)
    .gt('net_quantity', 0)

  if (error) {
    return { data: null, error: error.message }
  }

  if (!holdings || holdings.length === 0) {
    return {
      data: {
        totalInvested: 0,
        currentValue: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        totalFees: 0,
        holdingsCount: 0,
      },
      error: null,
    }
  }

  const symbols = holdings.map(h => h.symbol)
  let activeHoldings = holdings

  const wasRefreshed = await ensureFreshPrices(supabase, symbols)

  if (wasRefreshed) {
    const { data: refreshedHoldings, error: refreshedError } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', user.id)
      .gt('net_quantity', 0)

    if (!refreshedError && refreshedHoldings) {
      activeHoldings = refreshedHoldings as PortfolioHolding[]
    }
  }

  const totalInvested = activeHoldings.reduce((sum, h) => sum + Number(h.total_invested), 0)
  const currentValue = activeHoldings.reduce((sum, h) => sum + Number(h.current_value), 0)
  const totalGainLoss = currentValue - totalInvested
  const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0
  const totalFees = activeHoldings.reduce((sum, h) => sum + Number(h.total_fees), 0)

  return {
    data: {
      totalInvested,
      currentValue,
      totalGainLoss,
      totalGainLossPercent: parseFloat(totalGainLossPercent.toFixed(2)),
      totalFees,
      holdingsCount: activeHoldings.length,
    },
    error: null,
  }
}
