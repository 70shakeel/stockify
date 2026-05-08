import { Card } from '@/components/ui/Card'
import { formatCurrencyNoDecimals, formatPercent, getChangeColor, cn } from '@/lib/utils'
import type { PortfolioSummaryData } from '@/lib/psx/types'
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  BarChart3,
  Receipt,
  Layers,
  Landmark,
  ShieldAlert,
  DollarSign,
} from 'lucide-react'

interface PortfolioSummaryProps {
  summary: PortfolioSummaryData
}

export function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  const stats = [
    {
      label: 'Cash Available',
      value: formatCurrencyNoDecimals(summary.investmentAvailable),
      icon: Wallet,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Funds Added',
      value: formatCurrencyNoDecimals(summary.totalAddedFunds),
      icon: Landmark,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Current Value',
      value: formatCurrencyNoDecimals(summary.currentValue),
      icon: PiggyBank,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Realized P&L',
      value: formatCurrencyNoDecimals(summary.realizedGainLoss),
      icon: Receipt,
      color: getChangeColor(summary.realizedGainLoss),
      bgColor: summary.realizedGainLoss >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      label: 'Tax Paid (15%)',
      value: formatCurrencyNoDecimals(summary.totalTaxPaid),
      icon: ShieldAlert,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Dividends',
      value: formatCurrencyNoDecimals(summary.totalDividends),
      icon: DollarSign,
      color: getChangeColor(summary.totalDividends),
      bgColor: summary.totalDividends > 0 ? 'bg-amber-500/10' : 'bg-zinc-500/10',
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
      bgColor:
        summary.totalPNL >= 0
          ? 'bg-emerald-500/10'
          : 'bg-red-500/10',
      glow: summary.totalPNL >= 0 ? 'accent' as const : 'danger' as const,
    },
    {
      label: 'Holdings',
      value: summary.holdingsCount.toString(),
      icon: Layers,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
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
