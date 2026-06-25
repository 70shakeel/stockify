import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getPortfolios, getSharedPortfolios } from '@/actions/portfolios'
import {
  getPortfolioSummaryById,
  getPortfolioHoldingsById,
  getInvestmentsById,
  getPortfolioPositionsById,
  getPortfolioAccess,
  getTransactionsByPortfolioId,
} from '@/actions/portfolioById'
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary'
import { PortfolioTabs } from '@/components/dashboard/PortfolioTabs'
import { RememberPortfolio } from '@/components/dashboard/RememberPortfolio'
import { PortfolioSelectScreen } from '@/components/dashboard/PortfolioSelectScreen'
import { Spinner } from '@/components/ui/Spinner'
import { Lock } from 'lucide-react'
import { cn, formatCurrency, getChangeColor } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Portfolio — Stockify',
  description: 'View your portfolio holdings, unrealized gains/losses, and performance analytics.',
}

async function PortfolioContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const savedId = cookieStore.get('last_portfolio_id')?.value ?? null

  const [{ data: ownPortfolios }, { data: sharedPortfolios }] = await Promise.all([
    getPortfolios(),
    getSharedPortfolios(),
  ])

  const own = ownPortfolios ?? []
  const shared = sharedPortfolios ?? []
  const allIds = [...own.map(p => p.id), ...shared.map(p => p.id)]
  const activeId = savedId && allIds.includes(savedId) ? savedId : null

  if (!activeId) {
    return <PortfolioSelectScreen ownPortfolios={own} sharedPortfolios={shared} />
  }

  const access = await getPortfolioAccess(activeId)

  const [summaryResult, holdingsResult, investmentsResult, positionsResult, transactionsResult] = await Promise.all([
    getPortfolioSummaryById(activeId),
    getPortfolioHoldingsById(activeId),
    getInvestmentsById(activeId),
    getPortfolioPositionsById(activeId),
    getTransactionsByPortfolioId(activeId),
  ])

  const activePortfolio = own.find(p => p.id === activeId) ?? shared.find(p => p.id === activeId)

  return (
    <div className="space-y-8">
      <RememberPortfolio portfolioId={activeId} />
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{activePortfolio?.name ?? 'Portfolio'}</h1>
        {access.isPartner && (
          <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Owned by {access.ownerName ?? 'Portfolio Owner'} · Your share:{' '}
            <span className={cn('font-semibold', getChangeColor(
              summaryResult.data ? (summaryResult.data.totalPNL * (access.percentage ?? 0)) / 100 : 0
            ))}>
              {access.percentage?.toFixed(1)}%
              {summaryResult.data && ` · ${formatCurrency((summaryResult.data.totalPNL * (access.percentage ?? 0)) / 100)}`}
            </span>
          </p>
        )}
        {activePortfolio?.description && (
          <p className="text-sm text-zinc-500 mt-1">{activePortfolio.description}</p>
        )}
      </div>

      {summaryResult.data && <PortfolioSummary summary={summaryResult.data} />}

      <PortfolioTabs
        positions={positionsResult.data ?? []}
        holdings={holdingsResult.data ?? []}
        investments={investmentsResult.data ?? []}
        transactions={transactionsResult.data ?? []}
        isOwner={access.isOwner}
        portfolioId={activeId}
      />
    </div>
  )
}

export default function PortfolioPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        }
      >
        <PortfolioContent />
      </Suspense>
    </div>
  )
}
