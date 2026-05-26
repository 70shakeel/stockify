import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPortfolioHoldingsById, getPortfolioSummaryById, getInvestmentsById, getPortfolioPositionsById, getPortfolioAccess } from '@/actions/portfolioById'
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary'
import { PortfolioTabs } from '@/components/dashboard/PortfolioTabs'
import { Briefcase, ArrowLeft, Lock } from 'lucide-react'
import Link from 'next/link'
import { cn, formatCurrency, getChangeColor } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PortfolioDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [access, portfolioRow] = await Promise.all([
    getPortfolioAccess(id),
    supabase.from('portfolios').select('name, color, description').eq('id', id).single(),
  ])

  if (!access.isOwner && !access.isPartner) notFound()

  const portfolio = portfolioRow.data

  const [summaryResult, holdingsResult, investmentsResult, positionsResult] = await Promise.all([
    getPortfolioSummaryById(id),
    getPortfolioHoldingsById(id),
    getInvestmentsById(id),
    getPortfolioPositionsById(id),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back + header */}
      <div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: (portfolio?.color ?? '#10b981') + '20', border: `1px solid ${(portfolio?.color ?? '#10b981')}40` }}
          >
            <Briefcase className="w-5 h-5" style={{ color: portfolio?.color ?? '#10b981' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">{portfolio?.name ?? 'Portfolio'}</h1>
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
            {portfolio?.description && (
              <p className="text-sm text-zinc-500 mt-0.5">{portfolio.description}</p>
            )}
          </div>
        </div>
      </div>

      {summaryResult.data && <PortfolioSummary summary={summaryResult.data} />}

      <PortfolioTabs
        positions={positionsResult.data ?? []}
        holdings={holdingsResult.data}
        investments={investmentsResult.data}
      />
    </div>
  )
}
