import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { getPortfolios, getSharedPortfolios } from '@/actions/portfolios'
import { getPartnersByPortfolioId } from '@/actions/partners'
import {
  getPortfolioSummaryById,
  getPortfolioHoldingsById,
  getInvestmentsById,
  getPortfolioPositionsById,
  getPortfolioAccess,
} from '@/actions/portfolioById'
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary'
import { PortfolioTabs } from '@/components/dashboard/PortfolioTabs'
import { ProfitSplitSummary } from '@/components/dashboard/ProfitSplitSummary'
import { PortfolioSwitcher } from '@/components/dashboard/PortfolioSwitcher'
import { PortfolioSelectScreen } from '@/components/dashboard/PortfolioSelectScreen'
import { RefreshPricesButton } from '@/components/dashboard/RefreshPricesButton'
import { NewsFeed } from '@/components/news/NewsFeed'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { cn, formatCurrency, getChangeColor } from '@/lib/utils'
import {
  TrendingUp, Plus, Shield, Zap, Globe, BarChart3, Lock, Briefcase,
} from 'lucide-react'

async function DashboardContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <HeroSection />

  const cookieStore = await cookies()
  const savedId = cookieStore.get('last_portfolio_id')?.value ?? null

  const [{ data: ownPortfolios }, { data: sharedPortfolios }] = await Promise.all([
    getPortfolios(),
    getSharedPortfolios(),
  ])

  const own = ownPortfolios ?? []
  const shared = sharedPortfolios ?? []
  const allIds = [...own.map(p => p.id), ...shared.map(p => p.id)]

  // Validate the saved id still belongs to the user
  const activeId = savedId && allIds.includes(savedId) ? savedId : null

  if (!activeId) {
    return <PortfolioSelectScreen ownPortfolios={own} sharedPortfolios={shared} />
  }

  // Fetch full dashboard data for the active portfolio
  const access = await getPortfolioAccess(activeId)

  const [summaryResult, holdingsResult, investmentsResult, positionsResult] = await Promise.all([
    getPortfolioSummaryById(activeId),
    getPortfolioHoldingsById(activeId),
    getInvestmentsById(activeId),
    getPortfolioPositionsById(activeId),
  ])

  // Profit split — only for owner portfolios with partners
  let profitSplitPartners: Awaited<ReturnType<typeof getPartnersByPortfolioId>>['data'] = []
  if (access.isOwner) {
    const { data } = await getPartnersByPortfolioId(activeId)
    profitSplitPartners = data
  }

  const activePortfolio = own.find(p => p.id === activeId) ?? shared.find(p => p.id === activeId)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{activePortfolio?.name ?? 'Dashboard'}</h1>
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
            <p className="text-sm text-zinc-500 mt-0.5">{activePortfolio.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RefreshPricesButton portfolioId={activeId} />
          <PortfolioSwitcher
            activeId={activeId}
            ownPortfolios={own}
            sharedPortfolios={shared}
          />
        </div>
      </div>

      {/* Summary stats */}
      {summaryResult.data && <PortfolioSummary summary={summaryResult.data} />}

      {/* Holdings / Positions / Investments tabs */}
      <PortfolioTabs
        positions={positionsResult.data ?? []}
        holdings={holdingsResult.data ?? []}
        investments={investmentsResult.data ?? []}
      />

      {/* Profit split (owner only, if partners exist) */}
      {summaryResult.data && profitSplitPartners.length > 0 && (
        <ProfitSplitSummary partners={profitSplitPartners} summary={summaryResult.data} />
      )}

      <Suspense fallback={<Card className="py-12"><Spinner className="mx-auto" /></Card>}>
        <NewsFeed />
      </Suspense>
    </div>
  )
}

function HeroSection() {
  return (
    <div className="space-y-16">
      <div className="relative text-center py-20">
        <div className="absolute inset-0 gradient-hero opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08),transparent_70%)]" />
        <div className="relative space-y-6">
          <div className="flex justify-center">
            <Badge variant="success" pulse className="px-4 py-1.5">
              <Zap className="w-3 h-3" /> Live PSX Data
            </Badge>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-zinc-100 tracking-tight leading-tight">
            Your PSX Portfolio<br />
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
              Managed Beautifully
            </span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Track your Pakistan Stock Exchange investments in real-time with beautiful dashboards, smart analytics, and a premium dark interface.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/auth/signup" className="px-8 py-3.5 rounded-xl text-base font-semibold gradient-accent text-white hover:opacity-90 transition-opacity shadow-xl shadow-emerald-500/20 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Get Started Free
            </Link>
            <Link href="/stocks" className="px-8 py-3.5 rounded-xl text-base font-semibold border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-all flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Explore Stocks
            </Link>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {[
          { icon: BarChart3, title: 'Real-time Tracking', description: 'Live stock prices from PSX with automatic portfolio valuation and P&L calculations.', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { icon: Shield, title: 'Secure & Private', description: 'Row Level Security ensures your portfolio data is visible only to you. Always.', color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { icon: Globe, title: 'REST API Ready', description: 'Built with REST-compatible endpoints for future iOS and Android app integration.', color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((feature, i) => {
          const Icon = feature.icon
          return (
            <Card key={feature.title} className={`animate-fade-in-up opacity-0 stagger-${i + 1}`}>
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
            </Card>
          )
        })}
      </div>
      <Suspense fallback={<Card className="py-12"><Spinner className="mx-auto" /></Card>}>
        <NewsFeed />
      </Suspense>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" /></div>}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
