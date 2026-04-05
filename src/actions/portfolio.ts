'use server'

import { createClient } from '@/lib/supabase/server'
import type { PortfolioHolding, PortfolioSummaryData } from '@/lib/psx/types'

import { refreshStockPrice } from '@/actions/stocks'

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

  // Check if any holding has a cached price of 0 (e.g. from an un-fetched placeholder)
  const missingPriceSymbols = holdings
    .filter(h => Number(h.current_price) === 0)
    .map(h => h.symbol)

  if (missingPriceSymbols.length > 0) {
    // Wait for all missing stocks to be accurately scraped
    await Promise.all(missingPriceSymbols.map(sym => refreshStockPrice(sym)))

    // Refetch holdings with accurate pricing data
    const { data: refreshedData, error: refreshedError } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', user.id)
      .gt('net_quantity', 0)
      .order('current_value', { ascending: false })

    if (refreshedError) {
      return { data: holdings, error: refreshedError.message } // fallback to original
    }
    
    return { data: (refreshedData as PortfolioHolding[]) || [], error: null }
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

  // Check if any holding has a cached price of 0
  const missingPriceSymbols = holdings
    .filter(h => Number(h.current_price) === 0)
    .map(h => h.symbol)

  let activeHoldings = holdings

  if (missingPriceSymbols.length > 0) {
    // Wait for all missing stocks to be accurately scraped
    await Promise.all(missingPriceSymbols.map(sym => refreshStockPrice(sym)))

    // Refetch holdings with accurate pricing data
    const { data: refreshedHoldings, error: refreshedError } = await supabase
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', user.id)
      .gt('net_quantity', 0)

    if (!refreshedError && refreshedHoldings) {
      activeHoldings = refreshedHoldings
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
