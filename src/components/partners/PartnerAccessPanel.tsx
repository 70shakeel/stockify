'use client'

import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, Briefcase } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn, formatCurrency, getChangeColor } from '@/lib/utils'
import type { PartnerPortfolioAccess } from '@/actions/partnerView'

interface Props {
  portfolios: PartnerPortfolioAccess[]
}

export function PartnerAccessPanel({ portfolios }: Props) {
  if (portfolios.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Profit Split</h1>
          <p className="text-sm text-zinc-500 mt-1">Portfolios you have been invited to view</p>
        </div>
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="w-12 h-12 text-zinc-700 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Portfolio Access Yet</h3>
          <p className="text-sm text-zinc-500 max-w-sm">
            You haven&apos;t been added to any portfolios. Accept an invitation link to see shared portfolio data here.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Profit Split</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Portfolios shared with you — your profit share across {portfolios.length} {portfolios.length === 1 ? 'portfolio' : 'portfolios'}
        </p>
      </div>

      {portfolios.map(p => (
        <Card key={p.partner_id} padding="none" className="overflow-hidden">
          {/* Portfolio header */}
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: p.color + '20', border: `1px solid ${p.color}40` }}
            >
              <Briefcase className="w-4 h-4" style={{ color: p.color }} />
            </div>
            <div>
              <p className="font-semibold text-zinc-100">{p.portfolio_name}</p>
              <p className="text-xs text-zinc-500">Owned by {p.owner_name}</p>
            </div>
            <div className="ml-auto">
              <span
                className="text-sm font-semibold px-3 py-1 rounded-full"
                style={{ backgroundColor: p.color + '20', color: p.color }}
              >
                {p.percentage.toFixed(1)}% share
              </span>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* P&L breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3">
                <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Realized
                </p>
                <p className={cn('text-sm font-semibold', getChangeColor(p.realized_gain_loss))}>
                  {p.realized_gain_loss >= 0 ? '+' : ''}{formatCurrency(p.realized_gain_loss)}
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3">
                <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Unrealized
                </p>
                <p className={cn('text-sm font-semibold', getChangeColor(p.unrealized_gain_loss))}>
                  {p.unrealized_gain_loss >= 0 ? '+' : ''}{formatCurrency(p.unrealized_gain_loss)}
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3">
                <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-400" /> Dividends
                </p>
                <p className={cn('text-sm font-semibold', p.total_dividends > 0 ? 'text-amber-400' : 'text-zinc-400')}>
                  {p.total_dividends > 0 ? '+' : ''}{formatCurrency(p.total_dividends)}
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3">
                <p className="text-xs text-zinc-500 mb-1">Total P&L</p>
                <p className={cn('text-sm font-semibold', getChangeColor(p.total_pnl))}>
                  {p.total_pnl >= 0 ? '+' : ''}{formatCurrency(p.total_pnl)}
                </p>
              </div>
            </div>

            {/* My share breakdown */}
            <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800">
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-zinc-400">My profit share ({p.percentage.toFixed(1)}%)</span>
                <span className={cn('font-semibold', getChangeColor(p.my_share))}>
                  {p.my_share >= 0 ? '+' : ''}{formatCurrency(p.my_share)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-zinc-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-red-400" /> Withdrawn
                </span>
                <span className={cn('font-medium', p.withdrawn > 0 ? 'text-red-400' : 'text-zinc-500')}>
                  {p.withdrawn > 0 ? '-' : ''}{formatCurrency(p.withdrawn)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm bg-zinc-900/40 rounded-b-xl">
                <span className="font-medium text-zinc-300">Net balance</span>
                <span className={cn('font-bold text-base', getChangeColor(p.net_share))}>
                  {p.net_share >= 0 ? '+' : ''}{formatCurrency(p.net_share)}
                </span>
              </div>
            </div>

            {/* Portfolio value context */}
            <div className="flex gap-4 text-xs text-zinc-600">
              <span>Portfolio value: <span className="text-zinc-400">{formatCurrency(p.current_value)}</span></span>
              <span>·</span>
              <span>Invested: <span className="text-zinc-400">{formatCurrency(p.total_invested)}</span></span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
