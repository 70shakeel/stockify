'use server'

import { createClient } from '@/lib/supabase/server'
import type { PortfolioHolding, PortfolioPosition, PortfolioSummaryData } from '@/lib/psx/types'
import { type Lot, addBuyLot, consumeSellLots, lotsAvgCost, lotsTotalCost } from '@/lib/lots'

import { refreshStockPrice } from '@/actions/stocks'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function toFiniteNumber(value: number) {
  return Number.isFinite(value) ? value : 0
}

/**
 * Replay transactions for each symbol in chronological order and derive
 * FIFO `cost_basis` for every SELL row.
 *
 * FIFO: sells consume the oldest purchased lots first.  When the position is
 * fully closed (open qty hits 0) a new lot starts so historical buys don't
 * skew a fresh position's avg cost.  Fees are excluded from cost basis.
 *
 * Always overwrites any stored value so stale DB entries (e.g. from backdated
 * BUYs inserted after the SELL) are corrected in-memory.
 * Mutates the array in-place and returns it.
 */
function enrichWithCostBasis<T extends {
  symbol: string
  type: string
  quantity: number | string
  price_per_share: number | string
  fees?: number | string | null
  cost_basis?: number | string | null
  executed_at: string
  created_at?: string
}>(transactions: T[]): T[] {
  const bySymbol = new Map<string, T[]>()
  for (const tx of transactions) {
    const bucket = bySymbol.get(tx.symbol) ?? []
    bucket.push(tx)
    bySymbol.set(tx.symbol, bucket)
  }

  for (const symbolTxs of bySymbol.values()) {
    const chrono = [...symbolTxs].sort((a, b) => {
      const d = new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
      if (d !== 0) return d
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0
      return ca - cb
    })

    const lots: Lot[] = []

    for (const tx of chrono) {
      const qty = Number(tx.quantity)
      const price = Number(tx.price_per_share)

      if (tx.type === 'BUY') {
        addBuyLot(lots, qty, price)
      } else if (tx.type === 'SELL') {
        tx.cost_basis = consumeSellLots(lots, qty)
      }
    }
  }

  return transactions
}

function isMissingInvestmentsTable(message: string) {
  return message.includes('relation "investments" does not exist')
}

async function ensureFreshPrices(supabase: SupabaseServerClient, symbols: string[]) {
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
    .filter((s: { symbol: string; last_price: number | string | null; last_updated: string | null }) => {
      if (Number(s.last_price) === 0) return true
      if (!s.last_updated) return true
      const age = now - new Date(s.last_updated).getTime()
      return age > STALE_MS
    })
    .map((s: { symbol: string }) => s.symbol)

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

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('executed_at', { ascending: true })

  if (txError) {
    return { data: null, error: txError.message }
  }

  const { data: investments, error: investmentsError } = await supabase
    .from('investments')
    .select('type, amount')
    .eq('user_id', user.id)

  const investmentRows = isMissingInvestmentsTable(investmentsError?.message || '')
    ? []
    : investments || []

  if (investmentsError && !isMissingInvestmentsTable(investmentsError.message)) {
    return { data: null, error: investmentsError.message }
  }

  const totalAddedFunds = investmentRows.reduce((sum, entry) => {
    return entry.type === 'ADD' ? sum + Number(entry.amount) : sum
  }, 0)
  const totalWithdrawnFunds = investmentRows.reduce((sum, entry) => {
    return entry.type === 'WITHDRAW' ? sum + Number(entry.amount) : sum
  }, 0)

  // Ensure every SELL row has a cost_basis (back-fills legacy null rows).
  const enrichedTxs = enrichWithCostBasis(transactions || [])

  const CAPITAL_GAINS_TAX_RATE = 0.15

  // Realized P&L = sum of each SELL transaction's P&L, net of 15% capital gains tax on profits.
  // Gross P&L per sell = qty × sell_price − fees − qty × cost_basis
  // Tax = gross P&L × 15% (only when gross P&L > 0)
  let realizedGainLoss = 0
  let totalTaxPaid = 0
  let totalFees = 0
  let totalBuyValue = 0
  let totalSellValue = 0

  for (const tx of enrichedTxs) {
    const qty = Number(tx.quantity)
    const price = Number(tx.price_per_share)
    const fees = Number(tx.fees || 0)
    totalFees += fees

    if (tx.type === 'BUY') {
      totalBuyValue += qty * price + fees
    } else if (tx.type === 'SELL') {
      const proceeds = qty * price - fees
      totalSellValue += proceeds
      const costBasis = Number(tx.cost_basis ?? 0)
      const grossPnl = proceeds - qty * costBasis
      const tax = grossPnl > 0 ? grossPnl * CAPITAL_GAINS_TAX_RATE : 0
      totalTaxPaid += tax
      realizedGainLoss += grossPnl - tax
    }
  }

  const investmentAvailable = totalAddedFunds - totalWithdrawnFunds - totalBuyValue + totalSellValue

  if (!holdings || holdings.length === 0) {
    return {
      data: {
        totalInvested: 0,
        currentValue: 0,
        totalGainLoss: realizedGainLoss,
        totalGainLossPercent: 0,
        totalFees,
        holdingsCount: 0,
        realizedGainLoss,
        potentialGainLoss: 0,
        totalPNL: realizedGainLoss,
        investmentAvailable,
        totalAddedFunds,
        totalWithdrawnFunds,
        totalTaxPaid,
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
  const potentialGainLoss = currentValue - totalInvested
  const totalPNL = potentialGainLoss + realizedGainLoss
  const totalGainLossPercent = totalInvested > 0 ? (potentialGainLoss / totalInvested) * 100 : 0

  return {
    data: {
      totalInvested,
      currentValue,
      totalGainLoss: totalPNL, // Overall P&L
      totalGainLossPercent: parseFloat(totalGainLossPercent.toFixed(2)),
      totalFees,
      holdingsCount: activeHoldings.length,
      realizedGainLoss,
      potentialGainLoss,
      totalPNL,
      investmentAvailable,
      totalAddedFunds,
      totalWithdrawnFunds,
      totalTaxPaid,
    },
    error: null,
  }
}

export async function getPortfolioPositions(): Promise<{
  data: PortfolioPosition[]
  error: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('symbol, type, quantity, price_per_share, fees, cost_basis, executed_at, created_at')
    .eq('user_id', user.id)
    .order('executed_at', { ascending: true })
    .order('created_at', { ascending: true })

  if (txError) {
    return { data: [], error: txError.message }
  }

  const txRows = enrichWithCostBasis(transactions || [])
  if (txRows.length === 0) {
    return { data: [], error: null }
  }

  const symbols = [...new Set(txRows.map(tx => tx.symbol))]
  const shouldRefreshPrices = await ensureFreshPrices(supabase, symbols)

  const { data: stocks, error: stocksError } = await supabase
    .from('stocks')
    .select('symbol, name, last_price')
    .in('symbol', symbols)

  if (stocksError) {
    return { data: [], error: stocksError.message }
  }

  if (shouldRefreshPrices) {
    const { data: refreshedStocks, error: refreshedStocksError } = await supabase
      .from('stocks')
      .select('symbol, name, last_price')
      .in('symbol', symbols)

    if (!refreshedStocksError && refreshedStocks) {
      const refreshedStockMap = new Map(
        refreshedStocks.map(stock => [stock.symbol, stock])
      )
      const positions = buildPortfolioPositions(txRows as Parameters<typeof buildPortfolioPositions>[0], refreshedStockMap)
      return { data: positions, error: null }
    }
  }

  const stockMap = new Map(stocks.map(stock => [stock.symbol, stock]))
  const positions = buildPortfolioPositions(txRows as Parameters<typeof buildPortfolioPositions>[0], stockMap)

  return { data: positions, error: null }
}

const CAPITAL_GAINS_TAX_RATE = 0.15

function buildPortfolioPositions(
  transactions: Array<{
    symbol: string
    type: 'BUY' | 'SELL'
    quantity: number
    price_per_share: number
    fees: number | null
    cost_basis?: number | null
  }>,
  stockMap: Map<string, { symbol: string; name: string; last_price: number | string | null }>,
): PortfolioPosition[] {
  // Extend PortfolioPosition with a per-symbol FIFO lot queue (internal only)
  type PositionWithLots = PortfolioPosition & { lots: Lot[] }

  const positions = new Map<string, PositionWithLots>()

  for (const tx of transactions) {
    const stock = stockMap.get(tx.symbol)
    const currentPrice = Number(stock?.last_price || 0)
    const fees = Number(tx.fees || 0)
    const quantity = Number(tx.quantity)
    const pricePerShare = Number(tx.price_per_share)

    if (!positions.has(tx.symbol)) {
      positions.set(tx.symbol, {
        symbol: tx.symbol,
        stock_name: stock?.name || tx.symbol,
        current_price: currentPrice,
        bought_quantity: 0,
        sold_quantity: 0,
        open_quantity: 0,
        avg_buy_cost: 0,
        avg_sale_price: 0,
        avg_open_cost: 0,
        total_buy_cost: 0,
        total_sale_value: 0,
        invested_amount: 0,
        realized_proceeds: 0,
        realized_gain_loss: 0,
        tax_paid: 0,
        unrealized_gain_loss: 0,
        total_gain_loss: 0,
        total_gain_loss_percent: 0,
        total_fees: 0,
        status: 'CLOSED',
        lots: [],
      })
    }

    const position = positions.get(tx.symbol)!
    position.current_price = currentPrice
    position.stock_name = stock?.name || position.stock_name
    position.total_fees += fees

    if (tx.type === 'BUY') {
      // addBuyLot handles lot-reset when position was fully closed
      addBuyLot(position.lots, quantity, pricePerShare)

      const buyCost = quantity * pricePerShare + fees
      position.bought_quantity += quantity
      position.open_quantity += quantity
      position.total_buy_cost += buyCost
      position.invested_amount += buyCost
    } else {
      const sellProceeds = quantity * pricePerShare - fees
      position.sold_quantity += quantity
      position.total_sale_value += quantity * pricePerShare
      position.realized_proceeds += sellProceeds

      // FIFO: consume oldest lots and get cost basis (fees excluded, price only)
      const sellQuantity = Math.min(quantity, position.open_quantity)
      const fifoAvgCost = consumeSellLots(position.lots, sellQuantity)
      const soldCostBasis = fifoAvgCost * sellQuantity

      const grossPnl = sellProceeds - soldCostBasis
      const tax = grossPnl > 0 ? grossPnl * CAPITAL_GAINS_TAX_RATE : 0
      position.tax_paid += tax
      position.realized_gain_loss += grossPnl - tax
      position.open_quantity -= sellQuantity
      position.invested_amount -= soldCostBasis
    }
  }

  return [...positions.values()]
    .map(({ lots, ...position }) => {
      // FIFO avg cost = weighted avg of remaining (unsold) lots (fees excluded)
      const fifoAvgCost = lotsAvgCost(lots)
      const fifoOpenCost = lotsTotalCost(lots)

      position.avg_buy_cost = fifoAvgCost
      position.avg_sale_price = position.sold_quantity > 0
        ? position.total_sale_value / position.sold_quantity
        : 0
      position.avg_open_cost = position.open_quantity > 0 ? fifoAvgCost : 0
      position.unrealized_gain_loss = position.open_quantity > 0
        ? (position.current_price * position.open_quantity) - fifoOpenCost
        : 0
      position.total_gain_loss = position.realized_gain_loss + position.unrealized_gain_loss
      const totalCostBasis = position.bought_quantity > 0
        ? fifoOpenCost + (position.realized_proceeds - position.realized_gain_loss)
        : 0
      position.total_gain_loss_percent = totalCostBasis > 0
        ? (position.total_gain_loss / totalCostBasis) * 100
        : 0
      position.status = position.open_quantity > 0 ? 'OPEN' : 'CLOSED'

      return {
        ...position,
        avg_buy_cost: Number(toFiniteNumber(position.avg_buy_cost).toFixed(2)),
        avg_sale_price: Number(toFiniteNumber(position.avg_sale_price).toFixed(2)),
        avg_open_cost: Number(toFiniteNumber(position.avg_open_cost).toFixed(2)),
        total_buy_cost: Number(toFiniteNumber(position.total_buy_cost).toFixed(2)),
        total_sale_value: Number(toFiniteNumber(position.total_sale_value).toFixed(2)),
        invested_amount: Number(toFiniteNumber(position.invested_amount).toFixed(2)),
        realized_proceeds: Number(toFiniteNumber(position.realized_proceeds).toFixed(2)),
        realized_gain_loss: Number(toFiniteNumber(position.realized_gain_loss).toFixed(2)),
        tax_paid: Number(toFiniteNumber(position.tax_paid).toFixed(2)),
        unrealized_gain_loss: Number(toFiniteNumber(position.unrealized_gain_loss).toFixed(2)),
        total_gain_loss: Number(toFiniteNumber(position.total_gain_loss).toFixed(2)),
        total_gain_loss_percent: Number(toFiniteNumber(position.total_gain_loss_percent).toFixed(2)),
        total_fees: Number(toFiniteNumber(position.total_fees).toFixed(2)),
      }
    })
    .sort((a, b) => Math.abs(b.total_gain_loss) - Math.abs(a.total_gain_loss))
}
