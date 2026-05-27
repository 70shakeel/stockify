'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TransactionInput } from '@/lib/psx/types'
import { refreshStockPrice } from '@/actions/stocks'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Replay transactions for a symbol in chronological order to derive the
 * weighted-average cost-per-share for a SELL executed at `sellExecutedAt`.
 *
 * The avg cost of all buys in the current lot group stays fixed through
 * partial sells — it only resets when the position is fully closed (net qty
 * hits 0) and a new buy starts a fresh group. Fees are excluded from cost basis.
 *
 * Pass `excludeId` when updating an existing transaction so its old row is
 * not double-counted.
 */
async function computeCostBasisForSell(
  supabase: SupabaseServerClient,
  userId: string,
  symbol: string,
  sellExecutedAt: string,
  sellQty: number,
  excludeId?: string,
): Promise<number> {
  let query = supabase
    .from('transactions')
    .select('type, quantity, price_per_share, executed_at, created_at')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .lte('executed_at', sellExecutedAt)
    .order('executed_at', { ascending: true })
    .order('created_at', { ascending: true })

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data: txs } = await query

  // Replay prior transactions using weighted-average cost method.
  // The avg cost of all buys in the current lot group stays fixed through
  // partial sells — it only resets when the position is fully closed.
  let totalBuyCost = 0
  let totalBuyQty = 0
  let netQty = 0

  for (const tx of (txs ?? [])) {
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
      netQty -= qty
    }
  }

  return totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0
}

export async function addTransaction(input: TransactionInput) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to add transactions' }
  }

  // Validate input
  if (!input.symbol || !input.type || !input.quantity || input.price_per_share === undefined) {
    return { error: 'Missing required fields' }
  }

  if (input.quantity <= 0) {
    return { error: 'Quantity must be greater than 0' }
  }

  if (input.price_per_share < 0) {
    return { error: 'Price per share cannot be negative' }
  }

  if (!['BUY', 'SELL', 'DIVIDEND'].includes(input.type)) {
    return { error: 'Transaction type must be BUY, SELL, or DIVIDEND' }
  }

  const normalizedSymbol = input.symbol.toUpperCase().trim()

  // Resolve portfolio_id — use the one from input, or fall back to the user's default portfolio
  let portfolioId = input.portfolio_id ?? null
  if (!portfolioId) {
    const { data: defaultPortfolio } = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    portfolioId = defaultPortfolio?.id ?? null
  }
  if (!portfolioId) return { error: 'No portfolio found. Please create a portfolio first.' }

  // DIVIDEND transactions: no share checks, no cost basis
  if (input.type === 'DIVIDEND') {
    // Ensure stock exists in DB cache
    await supabase.from('stocks').upsert({
      symbol: normalizedSymbol,
      name: normalizedSymbol,
      sector: 'Unknown',
    }, { onConflict: 'symbol', ignoreDuplicates: true })

    refreshStockPrice(normalizedSymbol).catch(console.error)

    const { data, error } = await supabase.from('transactions').insert({
      user_id: user.id,
      portfolio_id: portfolioId,
      symbol: normalizedSymbol,
      type: 'DIVIDEND',
      quantity: 1,
      price_per_share: input.price_per_share, // total dividend amount
      fees: 0,
      cost_basis: null,
      notes: input.notes || null,
      executed_at: input.executed_at || new Date().toISOString(),
    }).select().single()

    if (error) {
      console.error('Dividend insert error:', error)
      return { error: error.message }
    }

    revalidatePath('/portfolio')
    revalidatePath('/transactions')
    revalidatePath('/')
    return { data, error: null }
  }

  // For SELL: verify user has enough shares, then compute cost basis via the
  // lot-aware replay (same as updateTransaction) so backdated sells get the
  // correct avg cost for their position in history rather than the current snapshot.
  let sellCostBasis: number | null = null
  if (input.type === 'SELL') {
    const { data: holdings } = await supabase
      .from('portfolio_holdings')
      .select('net_quantity')
      .eq('portfolio_id', portfolioId)
      .eq('symbol', normalizedSymbol)
      .single()

    const currentQty = Number(holdings?.net_quantity) || 0
    if (input.quantity > currentQty) {
      return {
        error: `Insufficient shares. You hold ${currentQty} shares of ${input.symbol}`,
      }
    }

    sellCostBasis = await computeCostBasisForSell(
      supabase,
      user.id,
      normalizedSymbol,
      input.executed_at || new Date().toISOString(),
      input.quantity,
    )
  }

  // Ensure stock exists in DB cache to satisfy Foreign Key constraints
  // If it doesn't exist, insert a basic placeholder. Real data will be backfilled by the scraper later.
  await supabase.from('stocks').upsert({
    symbol: normalizedSymbol,
    name: normalizedSymbol,
    sector: 'Unknown',
  }, { onConflict: 'symbol', ignoreDuplicates: true })

  // Fire off a background fetch so the 0.00 placeholder updates with actual data shortly after.
  refreshStockPrice(normalizedSymbol).catch(console.error)

  const { data, error } = await supabase.from('transactions').insert({
    user_id: user.id,
    portfolio_id: portfolioId,
    symbol: normalizedSymbol,
    type: input.type,
    quantity: input.quantity,
    price_per_share: input.price_per_share,
    fees: input.fees || 0,
    cost_basis: sellCostBasis,
    notes: input.notes || null,
    executed_at: input.executed_at || new Date().toISOString(),
  }).select().single()

  if (error) {
    console.error('Transaction insert error:', error)
    return { error: error.message }
  }

  revalidatePath('/portfolio')
  revalidatePath('/transactions')
  revalidatePath('/')

  return { data, error: null }
}

export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in' }
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', user.id) // RLS + explicit check

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/portfolio')
  revalidatePath('/transactions')
  revalidatePath('/')

  return { error: null }
}

export async function updateTransaction(transactionId: string, input: TransactionInput) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in' }
  }

  if (!input.symbol || !input.type || !input.quantity || input.price_per_share === undefined) {
    return { error: 'Missing required fields' }
  }

  const normalizedSymbol = input.symbol.toUpperCase().trim()

  await supabase.from('stocks').upsert({
    symbol: normalizedSymbol,
    name: normalizedSymbol,
    sector: 'Unknown',
  }, { onConflict: 'symbol', ignoreDuplicates: true })

  refreshStockPrice(normalizedSymbol).catch(console.error)

  // For SELL transactions recompute cost_basis (the executed_at may have changed,
  // which shifts its position in the lot history).
  let updatedCostBasis: number | null = null
  if (input.type === 'SELL') {
    updatedCostBasis = await computeCostBasisForSell(
      supabase,
      user.id,
      normalizedSymbol,
      input.executed_at || new Date().toISOString(),
      input.quantity,
      transactionId, // exclude self so the old row is not counted
    )
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({
      symbol: normalizedSymbol,
      type: input.type,
      quantity: input.quantity,
      price_per_share: input.price_per_share,
      fees: input.fees || 0,
      cost_basis: updatedCostBasis,
      notes: input.notes || null,
      executed_at: input.executed_at || new Date().toISOString(),
    })
    .eq('id', transactionId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Transaction update error:', error)
    return { error: error.message }
  }

  revalidatePath('/portfolio')
  revalidatePath('/transactions')
  revalidatePath('/')

  return { data, error: null }
}

export async function getTransactions(symbol?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  // Always fetch ALL transactions for the user so we can replay the full
  // lot history per symbol and back-fill any SELL rows missing cost_basis.
  const { data: allTxs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('executed_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  const rows = allTxs || []

  // Group by symbol and replay chronologically to derive cost_basis for any
  // SELL that has a null value (legacy rows inserted before this logic existed).
  const bySymbol: Record<string, typeof rows> = {}
  for (const tx of rows) {
    ;(bySymbol[tx.symbol] ??= []).push(tx)
  }

  for (const symbolTxs of Object.values(bySymbol)) {
    // Chronological order for the replay
    const chrono = [...symbolTxs].sort((a, b) => {
      const dateDiff = new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
      return dateDiff !== 0 ? dateDiff : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    // Weighted-average cost: avg cost of all buys in the current lot group
    // stays fixed through partial sells — only resets on full position close.
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

  // If filtering by symbol, apply it after the replay so the lot history is complete
  const filtered = symbol
    ? rows.filter(tx => tx.symbol === symbol.toUpperCase())
    : rows

  return { data: filtered, error: null }
}
