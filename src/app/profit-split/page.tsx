import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPartners } from '@/actions/partners'
import { getPortfolioSummary } from '@/actions/portfolio'
import { getProfitWithdrawals } from '@/actions/profitWithdrawals'
import { getMyPartnerAccess } from '@/actions/partnerView'
import { ProfitSplitPanel } from '@/components/partners/ProfitSplitPanel'
import { PartnerAccessPanel } from '@/components/partners/PartnerAccessPanel'

export const metadata = {
  title: 'Profit Split — Stockify',
}

export default async function ProfitSplitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const [partnersResult, summaryResult, withdrawalsResult, partnerAccessResult] = await Promise.all([
    getPartners(),
    getPortfolioSummary(),
    getProfitWithdrawals(),
    getMyPartnerAccess(),
  ])

  const isOwner = partnersResult.data.length > 0
  const isPartner = partnerAccessResult.data.length > 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* If user has invited partners of their own, show owner view */}
      {isOwner && (
        <ProfitSplitPanel
          initialPartners={partnersResult.data}
          summary={summaryResult.data}
          initialWithdrawals={withdrawalsResult.data}
        />
      )}

      {/* If user was invited to someone else's portfolio, show partner view */}
      {isPartner && (
        <div className={isOwner ? 'mt-12 pt-10 border-t border-zinc-800' : ''}>
          {isOwner && (
            <p className="text-xs text-zinc-600 uppercase tracking-wide mb-6">Portfolios you&apos;re invited to</p>
          )}
          <PartnerAccessPanel portfolios={partnerAccessResult.data} />
        </div>
      )}

      {/* Neither owner nor partner */}
      {!isOwner && !isPartner && (
        <ProfitSplitPanel
          initialPartners={[]}
          summary={summaryResult.data}
          initialWithdrawals={[]}
        />
      )}
    </div>
  )
}
