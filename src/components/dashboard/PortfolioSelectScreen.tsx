'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { setLastViewedPortfolio } from '@/actions/partners'
import { Card } from '@/components/ui/Card'
import { Briefcase, Plus, ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'
import type { Portfolio } from '@/lib/psx/types'

interface SharedPortfolio extends Portfolio {
  owner_name: string
  percentage: number
}

interface Props {
  ownPortfolios: Portfolio[]
  sharedPortfolios: SharedPortfolio[]
}

export function PortfolioSelectScreen({ ownPortfolios, sharedPortfolios }: Props) {
  const router = useRouter()
  const [selecting, setSelecting] = useState<string | null>(null)
  const hasAny = ownPortfolios.length > 0 || sharedPortfolios.length > 0

  async function handleSelect(id: string) {
    setSelecting(id)
    await setLastViewedPortfolio(id)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Select a Portfolio</h1>
          <p className="text-sm text-zinc-500 mt-1">Choose which portfolio to view on your dashboard</p>
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

      {ownPortfolios.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Your Portfolios</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownPortfolios.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                disabled={!!selecting}
                className="text-left w-full disabled:opacity-60"
              >
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
              </button>
            ))}
          </div>
        </div>
      )}

      {sharedPortfolios.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Shared With Me</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharedPortfolios.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                disabled={!!selecting}
                className="text-left w-full disabled:opacity-60"
              >
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
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
