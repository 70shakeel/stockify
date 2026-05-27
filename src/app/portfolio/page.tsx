import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getPortfolioSummary, getPortfolioHoldings, getPortfolioPositions } from '@/actions/portfolio'
import { getInvestments } from '@/actions/investments'
import { getTransactions } from '@/actions/transactions'
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary'
import { PortfolioTabs } from '@/components/dashboard/PortfolioTabs'
import { Spinner } from '@/components/ui/Spinner'

export const metadata: Metadata = {
  title: 'Portfolio — Stockify',
  description: 'View your portfolio holdings, unrealized gains/losses, and performance analytics.',
}

async function PortfolioContent() {
  const [summaryResult, holdingsResult, investmentsResult, positionsResult, transactionsResult] = await Promise.all([
    getPortfolioSummary(),
    getPortfolioHoldings(),
    getInvestments(),
    getPortfolioPositions(),
    getTransactions(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Portfolio</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Your complete portfolio overview with live valuations
        </p>
      </div>

      {/* Summary Stats */}
      {summaryResult.data && (
        <PortfolioSummary summary={summaryResult.data} />
      )}

      <PortfolioTabs
        positions={positionsResult.data}
        holdings={holdingsResult.data}
        investments={investmentsResult.data}
        transactions={transactionsResult.data}
        isOwner={true}
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
