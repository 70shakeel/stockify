import { Card } from '@/components/ui/Card'
import { formatCurrencyNoDecimals, formatPercent, getChangeColor, cn } from '@/lib/utils'
import type { Partner, PortfolioSummaryData } from '@/lib/psx/types'
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  BarChart3,
  Receipt,
  Layers,
  Landmark,
  DollarSign,
  ArrowUpRight,
  Globe,
} from 'lucide-react'

interface PortfolioSummaryProps {
  summary: PortfolioSummaryData
  partners?: Partner[]
}

export function PortfolioSummary({ summary, partners }: PortfolioSummaryProps) {
  const combinedRealized = summary.realizedGainLoss + summary.totalDividends

  const baseStats = [
    {
      label: 'Total Portfolio',
      value: formatCurrencyNoDecimals(summary.totalPortfolioValue),
      icon: Globe,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      glow: 'accent' as const,
    },
    {
      label: 'Cash Available',
      value: formatCurrencyNoDecimals(summary.investmentAvailable),
      icon: Wallet,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Invested Amount',
      value: formatCurrencyNoDecimals(summary.totalInvested),
      icon: Landmark,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Stock Value',
      value: formatCurrencyNoDecimals(summary.currentValue),
      icon: PiggyBank,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ]

  // Per-partner realized P&L cards (includes dividends), or a single card if no partners
  const realizedStats = partners && partners.length > 0
    ? partners.map(p => {
        const share = (combinedRealized * Number(p.percentage)) / 100
        return {
          label: `${p.name}'s Realized`,
          value: formatCurrencyNoDecimals(share),
          subValue: summary.totalDividends > 0
            ? `incl. ${formatCurrencyNoDecimals((summary.totalDividends * Number(p.percentage)) / 100)} div`
            : undefined,
          icon: Receipt,
          color: getChangeColor(share),
          bgColor: share >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
          accentColor: p.color,
        }
      })
    : [
        {
          label: 'Realized P&L',
          value: formatCurrencyNoDecimals(combinedRealized),
          subValue: summary.totalDividends > 0
            ? `incl. ${formatCurrencyNoDecimals(summary.totalDividends)} div`
            : undefined,
          icon: Receipt,
          color: getChangeColor(combinedRealized),
          bgColor: combinedRealized >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
          accentColor: undefined,
        },
      ]

  const tailStats = [
    {
      label: 'Profit Withdrawn',
      value: formatCurrencyNoDecimals(summary.totalProfitWithdrawn),
      icon: ArrowUpRight,
      color: summary.totalProfitWithdrawn > 0 ? 'text-red-400' : 'text-zinc-500',
      bgColor: summary.totalProfitWithdrawn > 0 ? 'bg-red-500/10' : 'bg-zinc-500/10',
    },
    {
      label: 'Potential P&L',
      value: formatCurrencyNoDecimals(summary.potentialGainLoss),
      subValue: formatPercent(summary.totalGainLossPercent),
      icon: BarChart3,
      color: getChangeColor(summary.potentialGainLoss),
      bgColor: summary.potentialGainLoss >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Total P&L',
      value: formatCurrencyNoDecimals(summary.totalPNL),
      icon: TrendingUp,
      color: getChangeColor(summary.totalPNL),
      bgColor: summary.totalPNL >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Holdings',
      value: summary.holdingsCount.toString(),
      icon: Layers,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
  ]

  const stats = [...baseStats, ...realizedStats, ...tailStats]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon
        const accentColor = (stat as { accentColor?: string }).accentColor
        return (
          <Card
            key={stat.label}
            glow={(stat as { glow?: 'accent' }).glow || null}
            className={cn(
              'animate-fade-in-up opacity-0',
              `stagger-${Math.min(i + 1, 6)}`
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                <Icon className={cn('w-4 h-4', stat.color)} />
              </div>
              {accentColor && (
                <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ backgroundColor: accentColor }} />
              )}
            </div>
            <p
              className={cn(
                'text-lg font-bold tracking-tight',
                ['text-blue-400', 'text-purple-400', 'text-cyan-400', 'text-amber-400'].includes(stat.color)
                  ? 'text-zinc-100'
                  : stat.color
              )}
            >
              {stat.value}
            </p>
            {(stat as { subValue?: string }).subValue && (
              <p className="text-xs text-zinc-500 mt-0.5">
                {(stat as { subValue?: string }).subValue}
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-1">{stat.label}</p>
          </Card>
        )
      })}
    </div>
  )
}
