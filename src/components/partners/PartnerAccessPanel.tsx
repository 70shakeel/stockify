'use client'

import { Briefcase } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { PartnerProfitList } from '@/components/partners/PartnerProfitList'
import type { PartnerPortfolioAccess } from '@/actions/partnerView'
import type { PortfolioSummaryData } from '@/lib/psx/types'

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
        // Reconstruct the PortfolioSummaryData shape that PartnerProfitList expects
        const summary: PortfolioSummaryData = {
          totalInvested: p.total_invested,
          currentValue: p.current_value,
          totalGainLoss: p.total_pnl,
          totalGainLossPercent: 0,
          totalFees: 0,
          holdingsCount: 0,
          realizedGainLoss: p.realized_gain_loss,
          potentialGainLoss: p.unrealized_gain_loss,
          totalPNL: p.total_pnl,
          investmentAvailable: 0,
          totalAddedFunds: 0,
          totalWithdrawnFunds: 0,
          totalTaxPaid: 0,
          totalDividends: p.total_dividends,
          totalProfitWithdrawn: p.withdrawn,
          totalPortfolioValue: p.current_value,
        }

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
              <div className="ml-auto flex gap-4 text-xs text-zinc-600">
                <span>Value: <span className="text-zinc-400">{formatCurrency(p.current_value)}</span></span>
                <span>·</span>
                <span>Invested: <span className="text-zinc-400">{formatCurrency(p.total_invested)}</span></span>
              </div>
            </div>

            {/* Full partner list — identical layout to owner view */}
            <PartnerProfitList
              partners={p.all_partners}
              summary={summary}
              myPartnerId={p.partner_id}
            />
          </div>
        )
      })}
    </div>
  )
}
