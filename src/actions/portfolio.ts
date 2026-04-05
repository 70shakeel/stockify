'use server'

import { createClient } from '@/lib/supabase/server'
import type { PortfolioHolding, PortfolioSummaryData } from '@/lib/psx/types'

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

  return { data: (data as PortfolioHolding[]) || [], error: null }
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

  const totalInvested = holdings.reduce((sum, h) => sum + Number(h.total_invested), 0)
  const currentValue = holdings.reduce((sum, h) => sum + Number(h.current_value), 0)
  const totalGainLoss = currentValue - totalInvested
  const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0
  const totalFees = holdings.reduce((sum, h) => sum + Number(h.total_fees), 0)

  return {
    data: {
      totalInvested,
      currentValue,
      totalGainLoss,
      totalGainLossPercent: parseFloat(totalGainLossPercent.toFixed(2)),
      totalFees,
      holdingsCount: holdings.length,
    },
    error: null,
  }
}
