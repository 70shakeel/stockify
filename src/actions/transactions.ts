'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TransactionInput } from '@/lib/psx/types'
import { refreshStockPrice } from '@/actions/stocks'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Replay transactions for a symbol in chronological order to derive the
 * weighted-average cost-per-share that would apply to a SELL executed at
 * `sellExecutedAt`.  Pass `excludeId` when updating an existing transaction
 * so its old row is not double-counted.
 *
 * Matches the lot-reset logic in portfolio_holdings: when open_qty hits 0 the
 * running cost resets so historical lots don't skew a new position's avg cost.
 * Fees are NOT included in the avg cost (consistent with portfolio_holdings view).
 */
async function computeCostBasisForSell(
  supabase: SupabaseServerClient,
  userId: string,
  symbol: string,
  sellExecutedAt: string,
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
    // @ts-expect-error – supabase-js supports .neq() chaining
    query = query.neq('id', excludeId)
  }

  const { data: txs } = await query

  let openQty = 0
  let totalCost = 0 // sum of (qty × price) for currently-held shares

  for (const tx of (txs ?? [])) {
    const qty = Number(tx.quantity)
    const price = Number(tx.price_per_share)

    if (tx.type === 'BUY') {
      if (openQty <= 0) { openQty = 0; totalCost = 0 } // lot reset
      openQty += qty
      totalCost += qty * price
    } else if (tx.type === 'SELL') {
      if (openQty > 0) {
        const avgCost = totalCost / openQty
        const sellQty = Math.min(qty, openQty)
        totalCost -= avgCost * sellQty
        openQty -= sellQty
      }
    }
  }

  return openQty > 0 ? totalCost / openQty : 0
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

  if (!['BUY', 'SELL'].includes(input.type)) {
    return { error: 'Transaction type must be BUY or SELL' }
  }

  // For SELL: verify user has enough shares and capture the current avg cost
  let sellCostBasis: number | null = null
  if (input.type === 'SELL') {
    const { data: holdings } = await supabase
      .from('portfolio_holdings')
      .select('net_quantity, avg_cost')
      .eq('user_id', user.id)
      .eq('symbol', input.symbol.toUpperCase())
      .single()

    const currentQty = Number(holdings?.net_quantity) || 0
    if (input.quantity > currentQty) {
      return {
        error: `Insufficient shares. You hold ${currentQty} shares of ${input.symbol}`,
      }
    }

    // avg_cost from the view is the weighted avg price of the current lot (fees excluded)
    sellCostBasis = holdings?.avg_cost != null ? Number(holdings.avg_cost) : 0
  }

  const normalizedSymbol = input.symbol.toUpperCase().trim()

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

    let openQty = 0
    let totalCost = 0

    for (const tx of chrono) {
      const qty = Number(tx.quantity)
      const price = Number(tx.price_per_share)

      if (tx.type === 'BUY') {
        if (openQty <= 0) { openQty = 0; totalCost = 0 } // lot reset
        openQty += qty
        totalCost += qty * price
      } else if (tx.type === 'SELL') {
        const avgCost = openQty > 0 ? totalCost / openQty : 0

        // Back-fill missing cost_basis in-memory (no DB write needed for display)
        if (tx.cost_basis == null) {
          tx.cost_basis = avgCost
        }

        const sellQty = Math.min(qty, openQty)
        if (openQty > 0) {
          totalCost -= avgCost * sellQty
          openQty -= sellQty
        }
      }
    }
  }

  // If filtering by symbol, apply it after the replay so the lot history is complete
  const filtered = symbol
    ? rows.filter(tx => tx.symbol === symbol.toUpperCase())
    : rows

  return { data: filtered, error: null }
}
