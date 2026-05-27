'use server'

import { createClient } from '@/lib/supabase/server'
import { getPortfolioSummaryById } from '@/actions/portfolioById'
import type { Partner } from '@/lib/psx/types'

export interface PartnerPortfolioAccess {
  partner_id: string
  portfolio_id: string
  portfolio_name: string
  owner_name: string
  // my own partner row
  my_percentage: number
  my_color: string
  my_notes: string | null
  // all partners in the portfolio (same data owner sees)
  all_partners: Partner[]
  // P&L from the canonical summary (identical numbers to what the owner sees)
  total_invested: number
  current_value: number
  realized_gain_loss: number
  unrealized_gain_loss: number
  total_dividends: number
  total_pnl: number
  // my share
  my_share: number
  withdrawn: number
  net_share: number
}

export async function getMyPartnerAccess(): Promise<{
  data: PartnerPortfolioAccess[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Not authenticated' }

  // My partner rows (portfolios I was invited to)
  const { data: myRows, error: myError } = await supabase
    .from('partners')
    .select('id, portfolio_id, percentage, color, notes, user_id, portfolios(name)')
    .eq('partner_user_id', user.id)

  if (myError) return { data: [], error: myError.message }
  if (!myRows || myRows.length === 0) return { data: [], error: null }

  const results: PartnerPortfolioAccess[] = []

  for (const row of myRows) {
    const portfolioId = row.portfolio_id
    const myPercentage = Number(row.percentage)

    // All partners in this portfolio via SECURITY DEFINER RPC (bypasses RLS)
    const { data: allPartnerRows } = await supabase
      .rpc('get_portfolio_partners', { p_portfolio_id: portfolioId })

    // Owner profile
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', row.user_id)
      .single()

    // Withdrawals for my partner record
    const { data: withdrawals } = await supabase
      .from('profit_withdrawals')
      .select('amount')
      .eq('partner_id', row.id)

    // Canonical P&L — same function the owner's dashboard uses
    const { data: summary } = await getPortfolioSummaryById(portfolioId)

    const totalPnl = summary?.totalPNL ?? 0
    const myShare = (totalPnl * myPercentage) / 100
    const withdrawn = (withdrawals ?? []).reduce((s, w) => s + Number(w.amount), 0)

    const portfolio = row.portfolios as unknown as { name: string } | null

    results.push({
      partner_id: row.id,
      portfolio_id: portfolioId,
      portfolio_name: portfolio?.name ?? 'Portfolio',
      owner_name: ownerProfile?.full_name ?? 'Portfolio Owner',
      my_percentage: myPercentage,
      my_color: row.color,
      my_notes: row.notes,
      all_partners: (allPartnerRows ?? []) as Partner[],
      total_invested: summary?.totalInvested ?? 0,
      current_value: summary?.currentValue ?? 0,
      realized_gain_loss: summary?.realizedGainLoss ?? 0,
      unrealized_gain_loss: summary?.potentialGainLoss ?? 0,
      total_dividends: summary?.totalDividends ?? 0,
      total_pnl: totalPnl,
      my_share: myShare,
      withdrawn,
      net_share: myShare - withdrawn,
    })
  }

  return { data: results, error: null }
}
