'use client'

import { useState } from 'react'
import { HoldingsTable } from '@/components/dashboard/HoldingsTable'
import { InvestmentsTable } from '@/components/dashboard/InvestmentsTable'
import { PositionsTable } from '@/components/dashboard/PositionsTable'
import type { InvestmentEntry, PortfolioHolding, PortfolioPosition } from '@/lib/psx/types'
import { cn, formatCurrency } from '@/lib/utils'

type PortfolioTab = 'positions' | 'holdings' | 'investments'

interface PortfolioTabsProps {
  positions: PortfolioPosition[]
  holdings: PortfolioHolding[]
  investments: InvestmentEntry[]
}

const tabs: Array<{ id: PortfolioTab; label: string }> = [
  { id: 'holdings', label: 'Holdings' },
  { id: 'positions', label: 'Positions' },
  { id: 'investments', label: 'Investments' },
]

export function PortfolioTabs({ positions, holdings, investments }: PortfolioTabsProps) {
  const [activeTab, setActiveTab] = useState<PortfolioTab>('holdings')

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900/70 p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer',
              activeTab === tab.id
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'positions' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-200">
            Positions ({positions.length})
          </h2>
          <PositionsTable positions={positions} />
        </div>
      )}

      {activeTab === 'holdings' && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-200">
              Holdings ({holdings.length})
            </h2>
            <span className="text-sm text-zinc-400">
              Invested{' '}
              <span className="font-semibold text-zinc-200">
                {formatCurrency(holdings.reduce((sum, h) => sum + Number(h.total_invested), 0))}
              </span>
            </span>
          </div>
          <HoldingsTable holdings={holdings} />
        </div>
      )}

      {activeTab === 'investments' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-200">
            Investments ({investments.length})
          </h2>
          <InvestmentsTable investments={investments} />
        </div>
      )}
    </div>
  )
}
