'use server'

import { createClient } from '@/lib/supabase/server'
import type { PortfolioHolding, PortfolioSummaryData, InvestmentEntry } from '@/lib/psx/types'

const TAX_RATE = 0.15

function enrichCostBasis<T extends {
  symbol: string; type: string; quantity: number | string
  price_per_share: number | string; fees?: number | string | null
  cost_basis?: number | string | null; executed_at: string; created_at?: string
}>(txs: T[]): T[] {
  const map = new Map<string, T[]>()
  for (const tx of txs) { const b = map.get(tx.symbol) ?? []; b.push(tx); map.set(tx.symbol, b) }
  for (const bucket of map.values()) {
    const ordered = [...bucket].sort((a, b) => {
      const d = new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
      if (d !== 0) return d
      return (a.created_at ? new Date(a.created_at).getTime() : 0) - (b.created_at ? new Date(b.created_at).getTime() : 0)
    })
    let cost = 0, qty = 0, net = 0
    for (const tx of ordered) {
      const q = Number(tx.quantity), p = Number(tx.price_per_share)
      if (tx.type === 'BUY') {
        if (net <= 0) { cost = 0; qty = 0 }
        cost += q * p; qty += q; net += q
      } else if (tx.type === 'SELL') {
        tx.cost_basis = qty > 0 ? cost / qty : 0; net -= q
      }
    }
  }
  return txs
}

export async function getPortfolioHoldingsById(portfolioId: string): Promise<{
  data: PortfolioHolding[]; error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('portfolio_holdings')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .gt('net_quantity', 0)
    .order('current_value', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data as PortfolioHolding[]) ?? [], error: null }
}

export async function getPortfolioSummaryById(portfolioId: string): Promise<{
  data: PortfolioSummaryData | null; error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  const [{ data: holdings }, { data: txs }, { data: investments }, { data: withdrawals }] = await Promise.all([
    supabase.from('portfolio_holdings').select('*').eq('portfolio_id', portfolioId).gt('net_quantity', 0),
    supabase.from('transactions').select('*').eq('portfolio_id', portfolioId).order('executed_at', { ascending: true }),
    supabase.from('investments').select('type, amount').eq('portfolio_id', portfolioId),
    supabase.from('profit_withdrawals').select('amount').eq('user_id', user.id),
  ])

  const totalAddedFunds = (investments ?? []).filter(i => i.type === 'ADD').reduce((s, i) => s + Number(i.amount), 0)
  const totalWithdrawnFunds = (investments ?? []).filter(i => i.type === 'WITHDRAW').reduce((s, i) => s + Number(i.amount), 0)
  const totalProfitWithdrawn = (withdrawals ?? []).reduce((s, w) => s + Number(w.amount), 0)

  const enriched = enrichCostBasis(txs ?? [])
  let realizedGainLoss = 0, totalTaxPaid = 0, totalFees = 0, totalDividends = 0

  for (const tx of enriched) {
    const qty = Number(tx.quantity), price = Number(tx.price_per_share), fees = Number(tx.fees ?? 0)
    totalFees += fees
    if (tx.type === 'BUY') { /* nothing */ }
    else if (tx.type === 'SELL') {
      const proceeds = qty * price - fees
      const gross = proceeds - qty * Number(tx.cost_basis ?? 0)
      const tax = gross > 0 ? gross * TAX_RATE : 0
      totalTaxPaid += tax; realizedGainLoss += gross - tax
    } else if (tx.type === 'DIVIDEND') { totalDividends += price }
  }

  const totalInvested = (holdings ?? []).reduce((s, h) => s + Number(h.total_invested), 0)
  const currentValue = (holdings ?? []).reduce((s, h) => s + Number(h.current_value), 0)
  const potentialGainLoss = currentValue - totalInvested
  const totalPNL = potentialGainLoss + realizedGainLoss + totalDividends
  const totalPortfolioValue = totalAddedFunds - totalWithdrawnFunds + realizedGainLoss - totalProfitWithdrawn + totalDividends - totalInvested + currentValue

  return {
    data: {
      totalInvested, currentValue,
      totalGainLoss: totalPNL,
      totalGainLossPercent: totalInvested > 0 ? parseFloat(((potentialGainLoss / totalInvested) * 100).toFixed(2)) : 0,
      totalFees, holdingsCount: (holdings ?? []).length,
      realizedGainLoss, potentialGainLoss, totalPNL,
      investmentAvailable: totalPortfolioValue - totalInvested,
      totalAddedFunds, totalWithdrawnFunds, totalTaxPaid, totalDividends,
      totalProfitWithdrawn, totalPortfolioValue,
    },
    error: null,
  }
}

export async function getInvestmentsById(portfolioId: string): Promise<{
  data: InvestmentEntry[]; error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('invested_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data as InvestmentEntry[]) ?? [], error: null }
}

export async function getPortfolioAccess(portfolioId: string): Promise<{
  isOwner: boolean; isPartner: boolean; ownerName: string | null; percentage: number | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isOwner: false, isPartner: false, ownerName: null, percentage: null }

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('user_id')
    .eq('id', portfolioId)
    .single()

  if (!portfolio) return { isOwner: false, isPartner: false, ownerName: null, percentage: null }

  if (portfolio.user_id === user.id) {
    return { isOwner: true, isPartner: false, ownerName: null, percentage: null }
  }

  const { data: partner } = await supabase
    .from('partners')
    .select('percentage')
    .eq('portfolio_id', portfolioId)
    .eq('partner_user_id', user.id)
    .single()

  if (partner) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', portfolio.user_id)
      .single()
    return { isOwner: false, isPartner: true, ownerName: ownerProfile?.full_name ?? null, percentage: Number(partner.percentage) }
  }

  return { isOwner: false, isPartner: false, ownerName: null, percentage: null }
}
