'use server'

import { createClient } from '@/lib/supabase/server'
import { refreshStockPrice } from '@/actions/stocks'
import type { PortfolioHolding, PortfolioSummaryData, PortfolioPosition, InvestmentEntry } from '@/lib/psx/types'

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

export async function getPortfolioPositionsById(portfolioId: string): Promise<{
  data: PortfolioPosition[]; error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Not authenticated' }

  const { data: txs, error: txError } = await supabase
    .from('transactions')
    .select('symbol, type, quantity, price_per_share, fees, cost_basis, executed_at, created_at')
    .eq('portfolio_id', portfolioId)
    .order('executed_at', { ascending: true })
    .order('created_at', { ascending: true })

  if (txError) return { data: [], error: txError.message }
  if (!txs || txs.length === 0) return { data: [], error: null }

  const enriched = enrichCostBasis(txs)
  const symbols = [...new Set(enriched.map(t => t.symbol))]

  // Refresh stale prices
  const { data: stocksRaw } = await supabase
    .from('stocks')
    .select('symbol, name, last_price, last_updated')
    .in('symbol', symbols)

  const now = Date.now()
  const STALE_MS = 15 * 60 * 1000
  const stale = (stocksRaw ?? []).filter(s => {
    if (Number(s.last_price) === 0) return true
    if (!s.last_updated) return true
    return now - new Date(s.last_updated).getTime() > STALE_MS
  }).map(s => s.symbol)

  if (stale.length > 0) {
    await Promise.all(stale.map((sym: string) => refreshStockPrice(sym)))
  }

  const { data: stocks } = await supabase
    .from('stocks')
    .select('symbol, name, last_price')
    .in('symbol', symbols)

  const stockMap = new Map((stocks ?? []).map(s => [s.symbol, s]))

  const positions = buildPositions(
    enriched as Array<{ symbol: string; type: string; quantity: number | string; price_per_share: number | string; fees?: number | string | null; cost_basis?: number | string | null }>,
    stockMap
  )
  return { data: positions, error: null }
}

function toFinite(v: number) { return Number.isFinite(v) ? v : 0 }

function buildPositions(
  txs: Array<{
    symbol: string; type: string; quantity: number | string; price_per_share: number | string
    fees?: number | string | null; cost_basis?: number | string | null
  }>,
  stockMap: Map<string, { symbol: string; name: string; last_price: number | string | null }>
): PortfolioPosition[] {
  const bySymbol = new Map<string, typeof txs>()
  for (const tx of txs) {
    const b = bySymbol.get(tx.symbol) ?? []; b.push(tx); bySymbol.set(tx.symbol, b)
  }

  const all: PortfolioPosition[] = []

  for (const [symbol, rows] of bySymbol) {
    const stock = stockMap.get(symbol)
    const currentPrice = Number(stock?.last_price || 0)
    const stockName = stock?.name || symbol

    type Accum = {
      boughtQty: number; soldQty: number; openQty: number
      totalBuyCost: number; totalSaleValue: number; investedAmt: number
      realizedProceeds: number; realizedGL: number; taxPaid: number
      totalFees: number; buyPriceCost: number; buyPriceQty: number
    }

    const lots: Accum[] = []
    let cur: Accum | null = null

    for (const tx of rows) {
      const qty = Number(tx.quantity)
      const price = Number(tx.price_per_share)
      const fees = Number(tx.fees ?? 0)

      if (tx.type === 'BUY') {
        if (!cur || cur.openQty <= 0) {
          if (cur) lots.push(cur)
          cur = { boughtQty: 0, soldQty: 0, openQty: 0, totalBuyCost: 0, totalSaleValue: 0, investedAmt: 0, realizedProceeds: 0, realizedGL: 0, taxPaid: 0, totalFees: 0, buyPriceCost: 0, buyPriceQty: 0 }
        }
        cur.boughtQty += qty; cur.openQty += qty
        cur.totalBuyCost += qty * price + fees; cur.investedAmt += qty * price + fees
        cur.buyPriceCost += qty * price; cur.buyPriceQty += qty; cur.totalFees += fees
      } else if (tx.type === 'SELL' && cur) {
        const proceeds = qty * price - fees
        cur.soldQty += qty; cur.totalSaleValue += qty * price
        cur.realizedProceeds += proceeds; cur.totalFees += fees
        const sellQty = Math.min(qty, cur.openQty)
        const avgCost = cur.buyPriceQty > 0 ? cur.buyPriceCost / cur.buyPriceQty : 0
        const gross = proceeds - avgCost * sellQty
        const tax = gross > 0 ? gross * TAX_RATE : 0
        cur.taxPaid += tax; cur.realizedGL += gross - tax; cur.openQty -= sellQty
        cur.investedAmt -= avgCost * sellQty
      }
    }
    if (cur) lots.push(cur)

    for (const pos of lots) {
      const avgCost = pos.buyPriceQty > 0 ? pos.buyPriceCost / pos.buyPriceQty : 0
      const avgSale = pos.soldQty > 0 ? pos.totalSaleValue / pos.soldQty : 0
      const openCost = pos.openQty * avgCost
      const unrealized = pos.openQty > 0 ? currentPrice * pos.openQty - openCost : 0
      const totalGL = pos.realizedGL + unrealized
      const costBasisTotal = pos.buyPriceQty > 0 ? openCost + (pos.realizedProceeds - pos.realizedGL) : 0
      const totalGLPct = costBasisTotal > 0 ? (totalGL / costBasisTotal) * 100 : 0

      all.push({
        symbol, stock_name: stockName, current_price: currentPrice,
        bought_quantity: pos.boughtQty, sold_quantity: pos.soldQty, open_quantity: pos.openQty,
        avg_buy_cost: +toFinite(avgCost).toFixed(2),
        avg_sale_price: +toFinite(avgSale).toFixed(2),
        avg_open_cost: +toFinite(pos.openQty > 0 ? avgCost : 0).toFixed(2),
        total_buy_cost: +toFinite(pos.totalBuyCost).toFixed(2),
        total_sale_value: +toFinite(pos.totalSaleValue).toFixed(2),
        invested_amount: +toFinite(pos.investedAmt).toFixed(2),
        realized_proceeds: +toFinite(pos.realizedProceeds).toFixed(2),
        realized_gain_loss: +toFinite(pos.realizedGL).toFixed(2),
        tax_paid: +toFinite(pos.taxPaid).toFixed(2),
        unrealized_gain_loss: +toFinite(unrealized).toFixed(2),
        total_gain_loss: +toFinite(totalGL).toFixed(2),
        total_gain_loss_percent: +toFinite(totalGLPct).toFixed(2),
        total_fees: +toFinite(pos.totalFees).toFixed(2),
        status: pos.openQty > 0 ? 'OPEN' : 'CLOSED',
      })
    }
  }

  return all.sort((a, b) => Math.abs(b.total_gain_loss) - Math.abs(a.total_gain_loss))
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
