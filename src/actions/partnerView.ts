'use server'

import { createClient } from '@/lib/supabase/server'

export interface PartnerPortfolioAccess {
  partner_id: string
  portfolio_id: string
  portfolio_name: string
  owner_name: string
  percentage: number
  color: string
  notes: string | null
  // P&L
  total_invested: number
  current_value: number
  realized_gain_loss: number
  unrealized_gain_loss: number
  total_dividends: number
  total_pnl: number
  // my share
  my_share: number
  withdrawn: number
  net_share: number
}

export async function getMyPartnerAccess(): Promise<{
  data: PartnerPortfolioAccess[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Not authenticated' }

  // Fetch partner records where I am the invited partner
  const { data: partnerRows, error: partnerError } = await supabase
    .from('partners')
    .select('id, portfolio_id, percentage, color, notes, user_id, portfolios(name)')
    .eq('partner_user_id', user.id)

  if (partnerError) return { data: [], error: partnerError.message }
  if (!partnerRows || partnerRows.length === 0) return { data: [], error: null }

  const results: PartnerPortfolioAccess[] = []

  for (const row of partnerRows) {
    const portfolioId = row.portfolio_id
    const percentage = Number(row.percentage)

    // Holdings for this portfolio (partner has RLS access via portfolio_id)
    const { data: holdings } = await supabase
      .from('portfolio_holdings')
      .select('total_invested, current_value, unrealized_gain_loss')
      .eq('portfolio_id', portfolioId)
      .gt('net_quantity', 0)

    // Transactions for realized P&L
    const { data: transactions } = await supabase
      .from('transactions')
      .select('type, quantity, price_per_share, fees, cost_basis, executed_at, created_at')
      .eq('portfolio_id', portfolioId)
      .order('executed_at', { ascending: true })

    // Withdrawals for this partner
    const { data: withdrawals } = await supabase
      .from('profit_withdrawals')
      .select('amount')
      .eq('partner_id', row.id)

    const totalInvested = (holdings ?? []).reduce((s, h) => s + Number(h.total_invested), 0)
    const currentValue = (holdings ?? []).reduce((s, h) => s + Number(h.current_value), 0)
    const unrealizedGainLoss = (holdings ?? []).reduce((s, h) => s + Number(h.unrealized_gain_loss), 0)

    // Compute realized P&L and dividends from transactions
    let realizedGainLoss = 0
    let totalDividends = 0

    // Simple weighted avg cost basis per symbol
    const costMap = new Map<string, { totalCost: number; totalQty: number; netQty: number }>()

    for (const tx of (transactions ?? [])) {
      const qty = Number(tx.quantity)
      const price = Number(tx.price_per_share)
      const fees = Number(tx.fees ?? 0)
      const symbol = (tx as { type: string; quantity: number; price_per_share: number; fees: number; symbol?: string }).symbol ?? ''

      if (!costMap.has(symbol)) costMap.set(symbol, { totalCost: 0, totalQty: 0, netQty: 0 })
      const c = costMap.get(symbol)!

      if (tx.type === 'BUY') {
        if (c.netQty <= 0) { c.totalCost = 0; c.totalQty = 0 }
        c.totalCost += qty * price
        c.totalQty += qty
        c.netQty += qty
      } else if (tx.type === 'SELL') {
        const avgCost = c.totalQty > 0 ? c.totalCost / c.totalQty : Number(tx.cost_basis ?? 0)
        const proceeds = qty * price - fees
        const grossPnl = proceeds - qty * avgCost
        const tax = grossPnl > 0 ? grossPnl * 0.15 : 0
        realizedGainLoss += grossPnl - tax
        c.netQty -= qty
      } else if (tx.type === 'DIVIDEND') {
        totalDividends += price
      }
    }

    const totalPnl = realizedGainLoss + unrealizedGainLoss + totalDividends
    const myShare = (totalPnl * percentage) / 100
    const withdrawn = (withdrawals ?? []).reduce((s, w) => s + Number(w.amount), 0)

    const portfolio = row.portfolios as unknown as { name: string } | null

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', row.user_id)
      .single()

    results.push({
      partner_id: row.id,
      portfolio_id: portfolioId,
      portfolio_name: portfolio?.name ?? 'Portfolio',
      owner_name: ownerProfile?.full_name ?? 'Portfolio Owner',
      percentage,
      color: row.color,
      notes: row.notes,
      total_invested: totalInvested,
      current_value: currentValue,
      realized_gain_loss: realizedGainLoss,
      unrealized_gain_loss: unrealizedGainLoss,
      total_dividends: totalDividends,
      total_pnl: totalPnl,
      my_share: myShare,
      withdrawn,
      net_share: myShare - withdrawn,
    })
  }

  return { data: results, error: null }
}
