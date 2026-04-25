import { Suspense } from 'react'
import { getPortfolioSummary, getPortfolioHoldings } from '@/actions/portfolio'
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary'
import { HoldingsTable } from '@/components/dashboard/HoldingsTable'
import { NewsFeed } from '@/components/news/NewsFeed'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import {
  TrendingUp,
  BarChart3,
  Plus,
  ArrowRight,
  Shield,
  Zap,
  Globe,
} from 'lucide-react'

async function DashboardContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <HeroSection />
  }

  const [summaryResult, holdingsResult] = await Promise.all([
    getPortfolioSummary(),
    getPortfolioHoldings(),
  ])

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Welcome back — here&apos;s your portfolio overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" pulse>
            Market Open
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryResult.data && (
        <PortfolioSummary summary={summaryResult.data} />
      )}

      {/* Holdings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-200">Your Holdings</h2>
            {holdingsResult.data.length > 0 && (
              <p className="text-sm text-zinc-400 mt-0.5">
                Invested{' '}
                <span className="font-semibold text-zinc-200">
                  {formatCurrency(holdingsResult.data.reduce((sum, h) => sum + Number(h.total_invested), 0))}
                </span>
              </p>
            )}
          </div>
          <Link
            href="/portfolio"
            className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <HoldingsTable holdings={holdingsResult.data.slice(0, 5)} />
      </div>

      {/* News */}
      <Suspense fallback={<Card className="py-12"><Spinner className="mx-auto" /></Card>}>
        <NewsFeed />
      </Suspense>
    </div>
  )
}

function HeroSection() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <div className="relative text-center py-20">
        {/* Gradient background */}
        <div className="absolute inset-0 gradient-hero opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08),transparent_70%)]" />

        <div className="relative space-y-6">
          <div className="flex justify-center">
            <Badge variant="success" pulse className="px-4 py-1.5">
              <Zap className="w-3 h-3" />
              Live PSX Data
            </Badge>
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-zinc-100 tracking-tight leading-tight">
            Your PSX Portfolio
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
              Managed Beautifully
            </span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Track your Pakistan Stock Exchange investments in real-time with
            beautiful dashboards, smart analytics, and a premium dark interface.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href="/auth/signup"
              className="px-8 py-3.5 rounded-xl text-base font-semibold gradient-accent text-white hover:opacity-90 transition-opacity shadow-xl shadow-emerald-500/20 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Get Started Free
            </Link>
            <Link
              href="/stocks"
              className="px-8 py-3.5 rounded-xl text-base font-semibold border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-all flex items-center gap-2"
            >
              <TrendingUp className="w-5 h-5" />
              Explore Stocks
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6">
        {[
          {
            icon: BarChart3,
            title: 'Real-time Tracking',
            description: 'Live stock prices from PSX with automatic portfolio valuation and P&L calculations.',
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
          },
          {
            icon: Shield,
            title: 'Secure & Private',
            description: 'Row Level Security ensures your portfolio data is visible only to you. Always.',
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
          },
          {
            icon: Globe,
            title: 'REST API Ready',
            description: 'Built with REST-compatible endpoints for future iOS and Android app integration.',
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
          },
        ].map((feature, i) => {
          const Icon = feature.icon
          return (
            <Card
              key={feature.title}
              className={`animate-fade-in-up opacity-0 stagger-${i + 1}`}
            >
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {feature.description}
              </p>
            </Card>
          )
        })}
      </div>

      {/* News Section */}
      <div>
        <Suspense fallback={<Card className="py-12"><Spinner className="mx-auto" /></Card>}>
          <NewsFeed />
        </Suspense>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  )
}
