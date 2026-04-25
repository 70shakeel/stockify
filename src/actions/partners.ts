'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Partner, PartnerInput } from '@/lib/psx/types'

export async function getPartners(): Promise<{
  data: Partner[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { data: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data as Partner[]) ?? [], error: null }
}

export async function addPartner(input: PartnerInput): Promise<{
  data: Partner | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { data: null, error: 'Not authenticated' }

  if (!input.name.trim()) return { data: null, error: 'Partner name is required' }
  if (input.percentage <= 0 || input.percentage > 100) {
    return { data: null, error: 'Percentage must be between 0 and 100' }
  }

  const { data, error } = await supabase
    .from('partners')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      percentage: input.percentage,
      color: input.color ?? '#10b981',
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/profit-split')
  return { data: data as Partner, error: null }
}

export async function updatePartner(id: string, input: PartnerInput): Promise<{
  data: Partner | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { data: null, error: 'Not authenticated' }

  if (!input.name.trim()) return { data: null, error: 'Partner name is required' }
  if (input.percentage <= 0 || input.percentage > 100) {
    return { data: null, error: 'Percentage must be between 0 and 100' }
  }

  const { data, error } = await supabase
    .from('partners')
    .update({
      name: input.name.trim(),
      percentage: input.percentage,
      color: input.color ?? '#10b981',
      notes: input.notes?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/profit-split')
  return { data: data as Partner, error: null }
}

export async function deletePartner(id: string): Promise<{
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('partners')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profit-split')
  return { error: null }
}
