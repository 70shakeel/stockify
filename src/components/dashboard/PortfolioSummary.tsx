'use client'

import { useState } from 'react'
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
  ArrowUpRight,
  Globe,
  ChevronDown,
} from 'lucide-react'

interface StatItem {
  label: string
  value: string
  icon: React.ElementType
  color: string
  bgColor: string
  glow?: 'accent'
  subValue?: string
  breakdown?: { label: string; value: string; positive: boolean }[]
  accentColor?: string
}

interface PortfolioSummaryProps {
  summary: PortfolioSummaryData
  partners?: Partner[]
}

export function PortfolioSummary({ summary, partners }: PortfolioSummaryProps) {
  const [cashExpanded, setCashExpanded] = useState(false)
  const combinedRealized = summary.realizedGainLoss + summary.totalDividends

  const myPct = partners && partners.length > 0 ? Number(partners[0].percentage) / 100 : 1
  const myRealized = summary.realizedGainLoss * myPct
  const myDividends = summary.totalDividends * myPct
  const myCashAvailable = summary.totalAddedFunds - summary.totalWithdrawnFunds - summary.totalInvested - summary.totalProfitWithdrawn + myRealized + myDividends

  const cashBreakdown = [
    { label: 'Invested',     value: formatCurrencyNoDecimals(summary.totalAddedFunds),        positive: true  },
    { label: 'In stocks',    value: formatCurrencyNoDecimals(summary.totalInvested),           positive: false },
    { label: 'Inv. w/d',     value: formatCurrencyNoDecimals(summary.totalWithdrawnFunds),     positive: false },
    { label: 'Profit w/d',   value: formatCurrencyNoDecimals(summary.totalProfitWithdrawn),    positive: false },
    { label: 'Realized',     value: formatCurrencyNoDecimals(myRealized),                      positive: true  },
    { label: 'Dividends',    value: formatCurrencyNoDecimals(myDividends),                     positive: true  },
  ]

  const baseStats: StatItem[] = [
    {
      label: 'Total Portfolio',
      value: formatCurrencyNoDecimals(summary.totalPortfolioValue),
      icon: Globe,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      glow: 'accent',
    },
    {
      label: 'Cash Available',
      value: formatCurrencyNoDecimals(myCashAvailable),
      breakdown: cashBreakdown,
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

  const realizedStats: StatItem[] = partners && partners.length > 0
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
        },
      ]

  const tailStats: StatItem[] = [
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
              {stat.accentColor && (
                <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ backgroundColor: stat.accentColor }} />
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
            {stat.subValue ? (
              <p className="text-xs text-zinc-500 mt-0.5">{stat.subValue}</p>
            ) : null}
            {stat.breakdown ? (
              <div>
                <button
                  onClick={() => setCashExpanded(v => !v)}
                  className="flex items-center justify-between w-full mt-1 cursor-pointer group"
                >
                  <span className="text-xs text-zinc-500">{stat.label}</span>
                  <ChevronDown className={cn('w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-transform', cashExpanded && 'rotate-180')} />
                </button>
                {cashExpanded && (
                  <div className="mt-1.5 space-y-0.5">
                    {stat.breakdown.map(row => (
                      <div key={row.label} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-zinc-600">{row.label}</span>
                        <span className={cn('text-[10px] font-medium', row.positive ? 'text-zinc-400' : 'text-zinc-500')}>
                          {row.positive ? '+' : '−'}{row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 mt-1">{stat.label}</p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
