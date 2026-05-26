import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getPortfolios, getSharedPortfolios } from '@/actions/portfolios'
import { NewsFeed } from '@/components/news/NewsFeed'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import {
  TrendingUp, Plus, ArrowRight, Shield, Zap, Globe,
  BarChart3, Briefcase, Lock,
} from 'lucide-react'

async function DashboardContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <HeroSection />

  const [{ data: ownPortfolios }, { data: sharedPortfolios }] = await Promise.all([
    getPortfolios(),
    getSharedPortfolios(),
  ])

  const hasAny = (ownPortfolios?.length ?? 0) > 0 || (sharedPortfolios?.length ?? 0) > 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Select a portfolio to view its details</p>
        </div>
        <Link
          href="/portfolios"
          className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-accent text-white text-sm font-medium shadow-lg shadow-emerald-500/20 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> New Portfolio
        </Link>
      </div>

      {!hasAny && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="w-12 h-12 text-zinc-700 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Portfolios Yet</h3>
          <p className="text-sm text-zinc-500 max-w-sm mb-5">
            Create your first portfolio to start tracking your PSX investments.
          </p>
          <Link
            href="/portfolios"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Create Portfolio
          </Link>
        </Card>
      )}

      {/* Your portfolios */}
      {(ownPortfolios?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Your Portfolios</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownPortfolios!.map(p => (
              <Link key={p.id} href={`/portfolio/${p.id}`}>
                <Card hover className="h-full flex flex-col gap-3 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: p.color + '20', border: `1px solid ${p.color}40` }}
                    >
                      <Briefcase className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-100 truncate">{p.name}</p>
                      {p.description && <p className="text-xs text-zinc-500 truncate mt-0.5">{p.description}</p>}
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  </div>
                  <p className="text-xs text-zinc-600">
                    Created {new Date(p.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Shared portfolios */}
      {(sharedPortfolios?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Shared With Me</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharedPortfolios!.map(p => (
              <Link key={p.id} href={`/portfolio/${p.id}`}>
                <Card hover className="h-full flex flex-col gap-3 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: p.color + '20', border: `1px solid ${p.color}40` }}
                    >
                      <Briefcase className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-100 truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">by {p.owner_name}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3 text-zinc-600" />
                    <span className="text-xs text-zinc-500">Read-only · </span>
                    <span className="text-xs font-semibold" style={{ color: p.color }}>{p.percentage.toFixed(1)}% share</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
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
