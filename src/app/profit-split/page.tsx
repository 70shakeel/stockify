import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPartners } from '@/actions/partners'
import { getPortfolioSummary } from '@/actions/portfolio'
import { getProfitWithdrawals } from '@/actions/profitWithdrawals'
import { ProfitSplitPanel } from '@/components/partners/ProfitSplitPanel'

export const metadata = {
  title: 'Profit Split — Stockify',
}

export default async function ProfitSplitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const [partnersResult, summaryResult, withdrawalsResult] = await Promise.all([
    getPartners(),
    getPortfolioSummary(),
    getProfitWithdrawals(),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ProfitSplitPanel
        initialPartners={partnersResult.data}
        summary={summaryResult.data}
        initialWithdrawals={withdrawalsResult.data}
      />
    </div>
  )
}
