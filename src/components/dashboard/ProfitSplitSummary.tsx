import { Card } from '@/components/ui/Card'
import { cn, formatCurrency, getChangeColor } from '@/lib/utils'
import type { Partner, PortfolioSummaryData } from '@/lib/psx/types'
import { Users, ArrowRight, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'

interface ProfitSplitSummaryProps {
  partners: Partner[]
  summary: PortfolioSummaryData
}

export function ProfitSplitSummary({ partners, summary }: ProfitSplitSummaryProps) {
  if (partners.length === 0) return null

  const totalPnL = summary.totalPNL
  const realizedPnL = summary.realizedGainLoss
  const unrealizedPnL = summary.potentialGainLoss
  const totalDividends = summary.totalDividends
  const totalPercent = partners.reduce((sum, p) => sum + Number(p.percentage), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-500" />
          <h2 className="text-lg font-semibold text-zinc-200">Profit Split</h2>
          <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
            {partners.length} partner{partners.length > 1 ? 's' : ''}
          </span>
        </div>
        <Link
          href="/profit-split"
          className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
        >
          Manage <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <Card padding="none">
        {/* Allocation bar */}
        <div className="px-5 pt-4 pb-3">
          <div className="h-2 rounded-full overflow-hidden flex gap-px bg-zinc-800">
            {partners.map(p => (
              <div
                key={p.id}
                style={{
                  width: `${Math.min(Number(p.percentage), 100)}%`,
                  backgroundColor: p.color,
                }}
                className="transition-all duration-300"
                title={`${p.name}: ${p.percentage}%`}
              />
            ))}
          </div>
        </div>

        {/* Partner rows */}
        <div className="divide-y divide-zinc-800/60">
          {partners.map(partner => {
            const pct = Number(partner.percentage)
            const share = (totalPnL * pct) / 100
            const dividendShare = (totalDividends * pct) / 100

            const realizedShare = (realizedPnL * pct) / 100
            const unrealizedShare = (unrealizedPnL * pct) / 100

            return (
              <div key={partner.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: partner.color }}
                    >
                      {partner.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{partner.name}</p>
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
          <span className={cn('font-semibold', getChangeColor(totalPnL))}>
            Total: {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
          </span>
        </div>
      </Card>
    </div>
  )
}
