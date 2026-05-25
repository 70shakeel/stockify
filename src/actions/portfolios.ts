'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendPartnerInvitationEmail } from '@/lib/mailer'
import type { Portfolio, PortfolioInput, PortfolioMember, PartnerInvitation } from '@/lib/psx/types'

export async function getPortfolios(): Promise<{
  data: Portfolio[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data as Portfolio[]) ?? [], error: null }
}

export async function createPortfolio(input: PortfolioInput): Promise<{
  data: Portfolio | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  if (!input.name.trim()) return { data: null, error: 'Portfolio name is required' }

  const { data, error } = await supabase
    .from('portfolios')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      color: input.color ?? '#10b981',
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath('/portfolios')
  return { data: data as Portfolio, error: null }
}

export async function updatePortfolio(id: string, input: PortfolioInput): Promise<{
  data: Portfolio | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  if (!input.name.trim()) return { data: null, error: 'Portfolio name is required' }

  const { data, error } = await supabase
    .from('portfolios')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      color: input.color ?? '#10b981',
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath('/portfolios')
  return { data: data as Portfolio, error: null }
}

export async function deletePortfolio(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('portfolios')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/portfolios')
  return { error: null }
}

export async function getPortfolioMembers(portfolioId: string): Promise<{
  data: PortfolioMember[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Not authenticated' }

  // Accepted partners
  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('id, portfolio_id, name, email, percentage, color, notes, partner_user_id, created_at')
    .eq('portfolio_id', portfolioId)
    .eq('user_id', user.id)

  if (partnersError) return { data: [], error: partnersError.message }

  // Pending / declined invitations
  const { data: invites, error: invitesError } = await supabase
    .from('partner_invitations')
    .select('id, portfolio_id, invited_email, percentage, color, notes, status, token, expires_at, created_at')
    .eq('portfolio_id', portfolioId)
    .eq('inviter_user_id', user.id)
    .neq('status', 'accepted')

  if (invitesError) return { data: [], error: invitesError.message }

  // Fetch portfolio name
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('name')
    .eq('id', portfolioId)
    .single()

  const portfolioName = portfolio?.name ?? ''

  const members: PortfolioMember[] = [
    ...(partners ?? []).map(p => ({
      portfolio_id: portfolioId,
      portfolio_name: portfolioName,
      partner_id: p.id,
      name: p.name,
      email: p.email ?? '',
      percentage: Number(p.percentage),
      color: p.color,
      notes: p.notes,
      partner_user_id: p.partner_user_id,
      status: 'accepted' as const,
      created_at: p.created_at,
      expires_at: null,
      invitation_token: null,
    })),
    ...(invites ?? []).map(inv => ({
      portfolio_id: portfolioId,
      portfolio_name: portfolioName,
      partner_id: null,
      name: inv.invited_email,
      email: inv.invited_email,
      percentage: Number(inv.percentage),
      color: inv.color,
      notes: inv.notes,
      partner_user_id: null,
      status: inv.status as 'pending' | 'declined',
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      invitation_token: inv.token,
    })),
  ]

  return { data: members, error: null }
}

export async function sendInvitation(input: {
  portfolio_id: string
  invited_email: string
  percentage: number
  color?: string
  notes?: string
}): Promise<{ data: PartnerInvitation | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  if (!input.invited_email.trim()) return { data: null, error: 'Email is required' }
  if (input.percentage <= 0 || input.percentage > 100) {
    return { data: null, error: 'Percentage must be between 0 and 100' }
  }

  // Verify this portfolio belongs to the current user
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', input.portfolio_id)
    .eq('user_id', user.id)
    .single()

  if (!portfolio) return { data: null, error: 'Portfolio not found' }

  const { data, error } = await supabase
    .from('partner_invitations')
    .insert({
      portfolio_id: input.portfolio_id,
      inviter_user_id: user.id,
      invited_email: input.invited_email.trim().toLowerCase(),
      percentage: input.percentage,
      color: input.color ?? '#10b981',
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  // Fetch inviter's profile name for the email
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { data: portfolioRow } = await supabase
    .from('portfolios')
    .select('name')
    .eq('id', input.portfolio_id)
    .single()

  try {
    await sendPartnerInvitationEmail({
      to: input.invited_email.trim().toLowerCase(),
      inviterName: profile?.full_name ?? user.email ?? 'Your partner',
      portfolioName: portfolioRow?.name ?? 'Portfolio',
      percentage: input.percentage,
      token: (data as PartnerInvitation).token,
    })
  } catch {
    // Email failure is non-fatal — invitation is already saved in DB
  }

  revalidatePath('/portfolios')
  return { data: data as PartnerInvitation, error: null }
}

export async function revokeInvitation(invitationId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('partner_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('inviter_user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/portfolios')
  return { error: null }
}

export async function removePartner(partnerId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('partners')
    .delete()
    .eq('id', partnerId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/portfolios')
  return { error: null }
}
