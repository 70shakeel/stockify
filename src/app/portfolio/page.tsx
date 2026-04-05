import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getPortfolioSummary, getPortfolioHoldings } from '@/actions/portfolio'
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary'
import { HoldingsTable } from '@/components/dashboard/HoldingsTable'
import { Spinner } from '@/components/ui/Spinner'

export const metadata: Metadata = {
  title: 'Portfolio — Stockify',
  description: 'View your portfolio holdings, unrealized gains/losses, and performance analytics.',
}

async function PortfolioContent() {
  const [summaryResult, holdingsResult] = await Promise.all([
    getPortfolioSummary(),
    getPortfolioHoldings(),
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

      {/* Holdings Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">
          Holdings ({holdingsResult.data.length})
        </h2>
        <HoldingsTable holdings={holdingsResult.data} />
      </div>
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
