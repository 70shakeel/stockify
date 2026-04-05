'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TransactionInput } from '@/lib/psx/types'

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

  // For SELL: verify user has enough shares
  if (input.type === 'SELL') {
    const { data: holdings } = await supabase
      .from('portfolio_holdings')
      .select('net_quantity')
      .eq('user_id', user.id)
      .eq('symbol', input.symbol.toUpperCase())
      .single()

    const currentQty = Number(holdings?.net_quantity) || 0
    if (input.quantity > currentQty) {
      return {
        error: `Insufficient shares. You hold ${currentQty} shares of ${input.symbol}`,
      }
    }
  }

  const { data, error } = await supabase.from('transactions').insert({
    user_id: user.id,
    symbol: input.symbol.toUpperCase(),
    type: input.type,
    quantity: input.quantity,
    price_per_share: input.price_per_share,
    fees: input.fees || 0,
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

export async function getTransactions() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('executed_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}
