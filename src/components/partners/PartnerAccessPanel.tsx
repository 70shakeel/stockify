'use client'

import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, Briefcase, Users, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn, formatCurrency, getChangeColor } from '@/lib/utils'
import Link from 'next/link'
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

      {portfolios.map(p => {
        const totalPercent = p.all_partners.reduce((s, pt) => s + Number(pt.percentage), 0)

        return (
          <div key={p.partner_id} className="space-y-4">
            {/* Portfolio header */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: p.my_color + '20', border: `1px solid ${p.my_color}40` }}
              >
                <Briefcase className="w-4 h-4" style={{ color: p.my_color }} />
              </div>
              <div>
                <p className="font-semibold text-zinc-100">{p.portfolio_name}</p>
                <p className="text-xs text-zinc-500">Owned by {p.owner_name}</p>
              </div>
              <Link
                href="/profit-split"
                className="ml-auto text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                Details <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* All-partners split — identical to what the owner sees */}
            <Card padding="none">
              {/* Header */}
              <div className="px-5 pt-4 pb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-500" />
                <h2 className="text-base font-semibold text-zinc-200">Profit Split</h2>
                <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
                  {p.all_partners.length} partner{p.all_partners.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Allocation bar */}
              <div className="px-5 pb-3">
                <div className="h-2 rounded-full overflow-hidden flex gap-px bg-zinc-800">
                  {p.all_partners.map(pt => (
                    <div
                      key={pt.id}
                      style={{ width: `${Math.min(Number(pt.percentage), 100)}%`, backgroundColor: pt.color }}
                      className="transition-all duration-300"
                      title={`${pt.name}: ${pt.percentage}%`}
                    />
                  ))}
                </div>
              </div>

              {/* Partner rows */}
              <div className="divide-y divide-zinc-800/60">
                {p.all_partners.map(pt => {
                  const pct = Number(pt.percentage)
                  const share = (p.total_pnl * pct) / 100
                  const realizedShare = (p.realized_gain_loss * pct) / 100
                  const dividendShare = (p.total_dividends * pct) / 100
                  const unrealizedShare = (p.unrealized_gain_loss * pct) / 100
                  const isMe = pt.id === p.partner_id

                  return (
                    <div key={pt.id} className={cn('px-5 py-3', isMe && 'bg-zinc-800/30')}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                            style={{ backgroundColor: pt.color }}
                          >
                            {pt.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-200 truncate">
                              {pt.name}
                              {isMe && <span className="ml-1.5 text-[10px] text-zinc-500 font-normal">(you)</span>}
                            </p>
                            <p className="text-xs text-zinc-500">{pct.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-sm font-semibold', getChangeColor(share))}>
                            {share >= 0 ? '+' : ''}{formatCurrency(share)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 ml-10">
                        <div className="bg-zinc-800/40 rounded-md px-2.5 py-1.5">
                          <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <TrendingUp className="w-2.5 h-2.5" /> Realized
                          </p>
                          <p className={cn('text-xs font-medium mt-0.5', getChangeColor(realizedShare))}>
                            {realizedShare >= 0 ? '+' : ''}{formatCurrency(realizedShare)}
                          </p>
                        </div>
                        <div className="bg-zinc-800/40 rounded-md px-2.5 py-1.5">
                          <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <DollarSign className="w-2.5 h-2.5 text-amber-400" /> Dividends
                          </p>
                          <p className={cn('text-xs font-medium mt-0.5', dividendShare > 0 ? 'text-amber-400' : 'text-zinc-500')}>
                            {dividendShare > 0 ? '+' : ''}{formatCurrency(dividendShare)}
                          </p>
                        </div>
                        <div className="bg-zinc-800/40 rounded-md px-2.5 py-1.5">
                          <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <TrendingDown className="w-2.5 h-2.5" /> Unrealized
                          </p>
                          <p className={cn('text-xs font-medium mt-0.5', getChangeColor(unrealizedShare))}>
                            {unrealizedShare >= 0 ? '+' : ''}{formatCurrency(unrealizedShare)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-2.5 border-t border-zinc-800 bg-zinc-900/50 rounded-b-xl flex items-center justify-between text-xs text-zinc-500">
                <span>{totalPercent.toFixed(1)}% allocated</span>
                <span className={cn('font-semibold', getChangeColor(p.total_pnl))}>
                  Total: {p.total_pnl >= 0 ? '+' : ''}{formatCurrency(p.total_pnl)}
                </span>
              </div>
            </Card>

            {/* My share breakdown */}
            <Card padding="none" className="overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <p className="text-sm font-medium text-zinc-300">My Balance</p>
              </div>
              <div className="divide-y divide-zinc-800">
                <div className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-400">My profit share ({p.my_percentage.toFixed(1)}%)</span>
                  <span className={cn('font-semibold', getChangeColor(p.my_share))}>
                    {p.my_share >= 0 ? '+' : ''}{formatCurrency(p.my_share)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-red-400" /> Withdrawn
                  </span>
                  <span className={cn('font-medium', p.withdrawn > 0 ? 'text-red-400' : 'text-zinc-500')}>
                    {p.withdrawn > 0 ? '-' : ''}{formatCurrency(p.withdrawn)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-5 py-3 text-sm bg-zinc-900/40">
                  <span className="font-medium text-zinc-300">Net balance</span>
                  <span className={cn('font-bold text-base', getChangeColor(p.net_share))}>
                    {p.net_share >= 0 ? '+' : ''}{formatCurrency(p.net_share)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Portfolio context */}
            <div className="flex gap-4 text-xs text-zinc-600">
              <span>Portfolio value: <span className="text-zinc-400">{formatCurrency(p.current_value)}</span></span>
              <span>·</span>
              <span>Invested: <span className="text-zinc-400">{formatCurrency(p.total_invested)}</span></span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
