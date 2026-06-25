'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { InvestmentEntry, InvestmentInput } from '@/lib/psx/types'

function isMissingInvestmentsTable(message: string) {
  return message.includes('relation "investments" does not exist')
}

export async function getInvestments(): Promise<{
  data: InvestmentEntry[]
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
    .from('investments')
    .select('*')
    .eq('user_id', user.id)
    .order('invested_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingInvestmentsTable(error.message)) {
      return { data: [], error: null }
    }

    return { data: [], error: error.message }
  }

  return { data: (data as InvestmentEntry[]) || [], error: null }
}

export async function addInvestment(input: InvestmentInput) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to add investments' }
  }

  if (!['ADD', 'WITHDRAW'].includes(input.type)) {
    return { error: 'Investment type must be ADD or WITHDRAW' }
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Amount must be greater than 0' }
  }

  const { data, error } = await supabase
    .from('investments')
    .insert({
      user_id: user.id,
      portfolio_id: input.portfolio_id,
      type: input.type,
      amount: input.amount,
      notes: input.notes || null,
      invested_at: input.invested_at || new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    if (isMissingInvestmentsTable(error.message)) {
      return { error: 'The investments table is not set up yet. Please apply the latest Supabase schema first.' }
    }

    return { error: error.message }
  }

  revalidatePath('/portfolio')
  revalidatePath('/')

  return { data, error: null }
}

export async function deleteInvestment(investmentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in' }
  }

  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('id', investmentId)
    .eq('user_id', user.id)

  if (error) {
    if (isMissingInvestmentsTable(error.message)) {
      return { error: 'The investments table is not set up yet. Please apply the latest Supabase schema first.' }
    }

    return { error: error.message }
  }

  revalidatePath('/portfolio')
  revalidatePath('/')

  return { error: null }
}
