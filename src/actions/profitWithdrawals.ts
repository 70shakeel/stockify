'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ProfitWithdrawal, ProfitWithdrawalInput } from '@/lib/psx/types'

export async function getProfitWithdrawals(): Promise<{
  data: ProfitWithdrawal[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { data: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('profit_withdrawals')
    .select('*, partners(name, color)')
    .eq('user_id', user.id)
    .order('withdrawn_at', { ascending: false })

  if (error) return { data: [], error: error.message }

  const rows = (data ?? []).map((row: ProfitWithdrawal & { partners: { name: string; color: string } | null }) => ({
    ...row,
    partner_name: row.partners?.name ?? '',
    partner_color: row.partners?.color ?? '#10b981',
  }))

  return { data: rows, error: null }
}

export async function addProfitWithdrawal(input: ProfitWithdrawalInput): Promise<{
  data: ProfitWithdrawal | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { data: null, error: 'Not authenticated' }

  if (!input.partner_id) return { data: null, error: 'Partner is required' }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { data: null, error: 'Amount must be greater than 0' }
  }

  const { data, error } = await supabase
    .from('profit_withdrawals')
    .insert({
      user_id: user.id,
      partner_id: input.partner_id,
      amount: input.amount,
      notes: input.notes?.trim() || null,
      withdrawn_at: input.withdrawn_at || new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/profit-split')
  revalidatePath('/')

  return { data: data as ProfitWithdrawal, error: null }
}

export async function deleteProfitWithdrawal(id: string): Promise<{
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profit_withdrawals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profit-split')
  revalidatePath('/')

  return { error: null }
}
