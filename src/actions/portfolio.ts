'use server'

import { createClient } from '@/lib/supabase/server'
import type { PortfolioHolding, PortfolioPosition, PortfolioSummaryData } from '@/lib/psx/types'

import { refreshStockPrice } from '@/actions/stocks'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function toFiniteNumber(value: number) {
  return Number.isFinite(value) ? value : 0
}

/**
 * Replay transactions for each symbol in chronological order and derive
 * weighted-average `cost_basis` for every SELL row.
 *
 * The avg cost of all buys in the current lot group stays fixed through
 * partial sells — it only resets when the position is fully closed.
 * Fees are excluded from cost basis.
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

    let totalBuyCost = 0
    let totalBuyQty = 0
    let netQty = 0

    for (const tx of chrono) {
      const qty = Number(tx.quantity)
      const price = Number(tx.price_per_share)

      if (tx.type === 'BUY') {
        if (netQty <= 0) {
          totalBuyCost = 0
          totalBuyQty = 0
        }
        totalBuyCost += qty * price
        totalBuyQty += qty
        netQty += qty
      } else if (tx.type === 'SELL') {
        tx.cost_basis = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0
        netQty -= qty
      }
      // DIVIDEND rows don't affect cost basis
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

  const { data: profitWithdrawals } = await supabase
    .from('profit_withdrawals')
    .select('amount')
    .eq('user_id', user.id)

  const totalProfitWithdrawn = (profitWithdrawals ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  )

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
  let totalDividends = 0

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
    } else if (tx.type === 'DIVIDEND') {
      totalDividends += price // price_per_share holds the total dividend amount
    }
  }

  if (!holdings || holdings.length === 0) {
    // No open positions: invested=0, currentValue=0
    const totalPortfolioValue = totalAddedFunds - totalWithdrawnFunds + realizedGainLoss - totalProfitWithdrawn + totalDividends
    const investmentAvailable = totalPortfolioValue // nothing locked in stocks
    return {
      data: {
        totalInvested: 0,
        currentValue: 0,
        totalGainLoss: realizedGainLoss + totalDividends,
        totalGainLossPercent: 0,
        totalFees,
        holdingsCount: 0,
        realizedGainLoss,
        potentialGainLoss: 0,
        totalPNL: realizedGainLoss + totalDividends,
        investmentAvailable,
        totalAddedFunds,
        totalWithdrawnFunds,
        totalTaxPaid,
        totalDividends,
        totalProfitWithdrawn,
        totalPortfolioValue,
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
  const totalPNL = potentialGainLoss + realizedGainLoss + totalDividends
  const totalGainLossPercent = totalInvested > 0 ? (potentialGainLoss / totalInvested) * 100 : 0
  // Total portfolio = initial investment + realized profit - profit withdrawn + dividends - invested (at cost) + current market value
  const totalPortfolioValue = totalAddedFunds - totalWithdrawnFunds + realizedGainLoss - totalProfitWithdrawn + totalDividends - totalInvested + currentValue
  // Cash available = what's liquid = total portfolio minus what's locked in stocks at cost
  const investmentAvailableCalc = totalPortfolioValue - totalInvested

  return {
    data: {
      totalInvested,
      currentValue,
      totalGainLoss: totalPNL,
      totalGainLossPercent: parseFloat(totalGainLossPercent.toFixed(2)),
      totalFees,
      holdingsCount: activeHoldings.length,
      realizedGainLoss,
      potentialGainLoss,
      totalPNL,
      investmentAvailable: investmentAvailableCalc,
      totalAddedFunds,
      totalWithdrawnFunds,
      totalTaxPaid,
      totalDividends,
      totalProfitWithdrawn,
      totalPortfolioValue,
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
    type: 'BUY' | 'SELL' | 'DIVIDEND'
    quantity: number
    price_per_share: number
    fees: number | null
    cost_basis?: number | null
  }>,
  stockMap: Map<string, { symbol: string; name: string; last_price: number | string | null }>,
): PortfolioPosition[] {
  type PositionAccum = {
    symbol: string
    stock_name: string
    current_price: number
    bought_quantity: number
    sold_quantity: number
    open_quantity: number
    total_buy_cost: number
    total_sale_value: number
    invested_amount: number
    realized_proceeds: number
    realized_gain_loss: number
    tax_paid: number
    total_fees: number
    buy_price_cost: number
    buy_price_qty: number
  }

  // Group transactions by symbol
  const bySymbol = new Map<string, typeof transactions>()
  for (const tx of transactions) {
    const bucket = bySymbol.get(tx.symbol) ?? []
    bucket.push(tx)
    bySymbol.set(tx.symbol, bucket)
  }

  const allPositions: PortfolioPosition[] = []

  for (const [symbol, symbolTxs] of bySymbol) {
    const stock = stockMap.get(symbol)
    const currentPrice = Number(stock?.last_price || 0)
    const stockName = stock?.name || symbol

    // Each lot group becomes a separate position.
    // A new lot group starts when a BUY happens after the position was fully closed.
    const lotGroups: PositionAccum[] = []
    let current: PositionAccum | null = null

    for (const tx of symbolTxs) {
      const fees = Number(tx.fees || 0)
      const quantity = Number(tx.quantity)
      const pricePerShare = Number(tx.price_per_share)

      if (tx.type === 'BUY') {
        if (!current || current.open_quantity <= 0) {
          // Start a new lot group
          if (current) lotGroups.push(current)
          current = {
            symbol,
            stock_name: stockName,
            current_price: currentPrice,
            bought_quantity: 0,
            sold_quantity: 0,
            open_quantity: 0,
            total_buy_cost: 0,
            total_sale_value: 0,
            invested_amount: 0,
            realized_proceeds: 0,
            realized_gain_loss: 0,
            tax_paid: 0,
            total_fees: 0,
            buy_price_cost: 0,
            buy_price_qty: 0,
          }
        }

        const buyCost = quantity * pricePerShare + fees
        current.bought_quantity += quantity
        current.open_quantity += quantity
        current.total_buy_cost += buyCost
        current.invested_amount += buyCost
        current.buy_price_cost += quantity * pricePerShare
        current.buy_price_qty += quantity
        current.total_fees += fees
      } else if (tx.type === 'SELL' && current) {
        const sellProceeds = quantity * pricePerShare - fees
        current.sold_quantity += quantity
        current.total_sale_value += quantity * pricePerShare
        current.realized_proceeds += sellProceeds
        current.total_fees += fees

        const sellQuantity = Math.min(quantity, current.open_quantity)
        const weightedAvgCost = current.buy_price_qty > 0
          ? current.buy_price_cost / current.buy_price_qty
          : 0
        const soldCostBasis = weightedAvgCost * sellQuantity

        const grossPnl = sellProceeds - soldCostBasis
        const tax = grossPnl > 0 ? grossPnl * CAPITAL_GAINS_TAX_RATE : 0
        current.tax_paid += tax
        current.realized_gain_loss += grossPnl - tax
        current.open_quantity -= sellQuantity
        current.invested_amount -= soldCostBasis
      }
    }
    if (current) lotGroups.push(current)

    // Convert each lot group to a PortfolioPosition
    for (const pos of lotGroups) {
      const weightedAvgCost = pos.buy_price_qty > 0
        ? pos.buy_price_cost / pos.buy_price_qty
        : 0

      const avgSalePrice = pos.sold_quantity > 0
        ? pos.total_sale_value / pos.sold_quantity
        : 0

      const openCostAtAvg = pos.open_quantity * weightedAvgCost
      const unrealizedGainLoss = pos.open_quantity > 0
        ? (pos.current_price * pos.open_quantity) - openCostAtAvg
        : 0
      const totalGainLoss = pos.realized_gain_loss + unrealizedGainLoss
      const totalCostBasis = pos.buy_price_qty > 0
        ? openCostAtAvg + (pos.realized_proceeds - pos.realized_gain_loss)
        : 0
      const totalGainLossPercent = totalCostBasis > 0
        ? (totalGainLoss / totalCostBasis) * 100
        : 0

      allPositions.push({
        symbol: pos.symbol,
        stock_name: pos.stock_name,
        current_price: pos.current_price,
        bought_quantity: pos.bought_quantity,
        sold_quantity: pos.sold_quantity,
        open_quantity: pos.open_quantity,
        avg_buy_cost: Number(toFiniteNumber(weightedAvgCost).toFixed(2)),
        avg_sale_price: Number(toFiniteNumber(avgSalePrice).toFixed(2)),
        avg_open_cost: Number(toFiniteNumber(pos.open_quantity > 0 ? weightedAvgCost : 0).toFixed(2)),
        total_buy_cost: Number(toFiniteNumber(pos.total_buy_cost).toFixed(2)),
        total_sale_value: Number(toFiniteNumber(pos.total_sale_value).toFixed(2)),
        invested_amount: Number(toFiniteNumber(pos.invested_amount).toFixed(2)),
        realized_proceeds: Number(toFiniteNumber(pos.realized_proceeds).toFixed(2)),
        realized_gain_loss: Number(toFiniteNumber(pos.realized_gain_loss).toFixed(2)),
        tax_paid: Number(toFiniteNumber(pos.tax_paid).toFixed(2)),
        unrealized_gain_loss: Number(toFiniteNumber(unrealizedGainLoss).toFixed(2)),
        total_gain_loss: Number(toFiniteNumber(totalGainLoss).toFixed(2)),
        total_gain_loss_percent: Number(toFiniteNumber(totalGainLossPercent).toFixed(2)),
        total_fees: Number(toFiniteNumber(pos.total_fees).toFixed(2)),
        status: pos.open_quantity > 0 ? 'OPEN' : 'CLOSED',
      })
    }
  }

  return allPositions.sort((a, b) => Math.abs(b.total_gain_loss) - Math.abs(a.total_gain_loss))
}
