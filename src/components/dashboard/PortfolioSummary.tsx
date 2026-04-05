import { Card } from '@/components/ui/Card'
import { formatCurrency, formatPercent, getChangeColor, cn } from '@/lib/utils'
import type { PortfolioSummaryData } from '@/lib/psx/types'
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  BarChart3,
  Receipt,
  Layers,
} from 'lucide-react'

interface PortfolioSummaryProps {
  summary: PortfolioSummaryData
}

export function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  const stats = [
    {
      label: 'Total Invested',
      value: formatCurrency(summary.totalInvested),
      icon: Wallet,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Current Value',
      value: formatCurrency(summary.currentValue),
      icon: PiggyBank,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Total P&L',
      value: formatCurrency(summary.totalGainLoss),
      subValue: formatPercent(summary.totalGainLossPercent),
      icon: TrendingUp,
      color: getChangeColor(summary.totalGainLoss),
      bgColor:
        summary.totalGainLoss >= 0
          ? 'bg-emerald-500/10'
          : 'bg-red-500/10',
      glow: summary.totalGainLoss >= 0 ? 'accent' as const : 'danger' as const,
    },
    {
      label: 'Total Fees',
      value: formatCurrency(summary.totalFees),
      icon: Receipt,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Holdings',
      value: summary.holdingsCount.toString(),
      icon: Layers,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    {
      label: 'Daily Change',
      value: formatPercent(summary.totalGainLossPercent),
      icon: BarChart3,
      color: getChangeColor(summary.totalGainLossPercent),
      bgColor:
        summary.totalGainLossPercent >= 0
          ? 'bg-emerald-500/10'
          : 'bg-red-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon
        return (
          <Card
            key={stat.label}
            glow={stat.glow || null}
            className={cn(
              'animate-fade-in-up opacity-0',
              `stagger-${Math.min(i + 1, 6)}`
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                <Icon className={cn('w-4 h-4', stat.color)} />
              </div>
            </div>
            <p className={cn('text-lg font-bold tracking-tight', stat.color === 'text-blue-400' || stat.color === 'text-purple-400' || stat.color === 'text-amber-400' || stat.color === 'text-cyan-400' ? 'text-zinc-100' : stat.color)}>
              {stat.value}
            </p>
            {stat.subValue && (
              <p className={cn('text-xs font-medium mt-0.5', stat.color)}>
                {stat.subValue}
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-1">{stat.label}</p>
          </Card>
        )
      })}
    </div>
  )
}
