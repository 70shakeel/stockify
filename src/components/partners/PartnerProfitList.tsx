'use client'

import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, Trash2, Pencil } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn, formatCurrency, getChangeColor } from '@/lib/utils'
import type { Partner, PortfolioSummaryData, ProfitWithdrawal } from '@/lib/psx/types'

interface Props {
  partners: Partner[]
  summary: PortfolioSummaryData
  // owner-only: pass withdrawals + handlers to get the full editable view
  withdrawals?: ProfitWithdrawal[]
  myPartnerId?: string        // highlight this row with "(you)"
  deleteConfirmId?: string | null
  isPending?: boolean
  onEdit?: (partner: Partner) => void
  onDeleteConfirm?: (id: string) => void
  onDeleteCancel?: () => void
  onDeleteExecute?: (id: string) => void
  onWithdraw?: (partnerId: string) => void
  onDeleteWithdrawal?: (id: string) => void
}

export function PartnerProfitList({
  partners,
  summary,
  withdrawals = [],
  myPartnerId,
  deleteConfirmId,
  isPending,
  onEdit,
  onDeleteConfirm,
  onDeleteCancel,
  onDeleteExecute,
  onWithdraw,
  onDeleteWithdrawal,
}: Props) {
  const isOwnerView = !!onEdit

  const combinedRealized = summary.realizedGainLoss + summary.totalDividends
  const realizedPnL   = summary.realizedGainLoss
  const unrealizedPnL = summary.potentialGainLoss
  const totalDividends = summary.totalDividends
  const totalPercent  = partners.reduce((s, p) => s + Number(p.percentage), 0)

  return (
    <Card padding="none">
      {/* Allocation bar */}
      <div className="px-5 pt-4 pb-3">
        <div className="h-2.5 rounded-full overflow-hidden flex gap-px bg-zinc-800">
          {partners.map(p => (
            <div
              key={p.id}
              style={{ width: `${Math.min(Number(p.percentage), 100)}%`, backgroundColor: p.color }}
              className="transition-all duration-300"
              title={`${p.name}: ${p.percentage}%`}
            />
          ))}
        </div>
      </div>

      {/* Partner rows */}
      <div className="divide-y divide-zinc-800/60">
        {partners.map(partner => {
          const pct             = Number(partner.percentage)
          const share           = (combinedRealized * pct) / 100
          const realizedShare   = (realizedPnL * pct) / 100
          const unrealizedShare = (unrealizedPnL * pct) / 100
          const dividendShare   = (totalDividends * pct) / 100
          const isMe            = partner.id === myPartnerId
          const isConfirmingDelete = deleteConfirmId === partner.id

          const partnerWithdrawals = withdrawals.filter(w => w.partner_id === partner.id)
          const withdrawn = partnerWithdrawals.reduce((s, w) => s + Number(w.amount), 0)
          const netShare = share - withdrawn

          return (
            <div key={partner.id} className={cn('px-5 py-4', isMe && 'bg-zinc-800/20')}>
              <div className="flex items-start justify-between gap-4">
                {/* Partner info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: partner.color }}
                  >
                    {partner.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-200 truncate">{partner.name}</p>
                      <Badge variant="default" className="shrink-0">{pct.toFixed(1)}%</Badge>
                      {isMe && (
                        <span className="text-[10px] text-zinc-500 font-normal shrink-0">(you)</span>
                      )}
                    </div>
                    {partner.notes && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{partner.notes}</p>
                    )}
                  </div>
                </div>

                {/* Owner action buttons */}
                {isOwnerView && (
                  <div className="flex items-center gap-1 shrink-0">
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">Delete?</span>
                        <Button variant="danger" size="sm" isLoading={isPending} onClick={() => onDeleteExecute?.(partner.id)}>Yes</Button>
                        <Button variant="ghost" size="sm" onClick={onDeleteCancel}>No</Button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onWithdraw?.(partner.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Withdraw profit"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEdit?.(partner)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Edit partner"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteConfirm?.(partner.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Delete partner"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* P&L breakdown */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-zinc-500 mb-0.5">Total P&L Share</p>
                  <p className={cn('text-sm font-semibold', getChangeColor(share))}>
                    {share >= 0 ? '+' : ''}{formatCurrency(share)}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-zinc-500 mb-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Realized
                  </p>
                  <p className={cn('text-sm font-medium', getChangeColor(realizedShare))}>
                    {realizedShare >= 0 ? '+' : ''}{formatCurrency(realizedShare)}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-zinc-500 mb-0.5 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-amber-400" /> Dividends
                  </p>
                  <p className={cn('text-sm font-medium', dividendShare > 0 ? 'text-amber-400' : 'text-zinc-400')}>
                    {dividendShare > 0 ? '+' : ''}{formatCurrency(dividendShare)}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-zinc-500 mb-0.5 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Unrealized
                  </p>
                  <p className={cn('text-sm font-medium', getChangeColor(unrealizedShare))}>
                    {unrealizedShare >= 0 ? '+' : ''}{formatCurrency(unrealizedShare)}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-zinc-500 mb-0.5 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-red-400" /> Withdrawn
                  </p>
                  <p className={cn('text-sm font-medium', withdrawn > 0 ? 'text-red-400' : 'text-zinc-500')}>
                    {withdrawn > 0 ? '-' : ''}{formatCurrency(withdrawn)}
                  </p>
                </div>
              </div>

              {/* Net balance */}
              <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <span className="text-xs text-zinc-500">Net balance (after withdrawals)</span>
                <span className={cn('text-sm font-semibold', getChangeColor(netShare))}>
                  {netShare >= 0 ? '+' : ''}{formatCurrency(netShare)}
                </span>
              </div>

              {/* Withdrawal history — owner view only */}
              {isOwnerView && partnerWithdrawals.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs text-zinc-600 uppercase tracking-wide">Withdrawal history</p>
                  {partnerWithdrawals.map(w => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/60"
                    >
                      <span className="text-zinc-500">
                        {new Date(w.withdrawn_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {w.notes && <span className="ml-2 text-zinc-600">— {w.notes}</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-medium">-{formatCurrency(w.amount)}</span>
                        <button
                          onClick={() => onDeleteWithdrawal?.(w.id)}
                          className="text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete withdrawal"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {partners.length > 1 && (
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900/50 rounded-b-xl flex items-center justify-between text-sm">
          <span className="text-zinc-500">{partners.length} partners · {totalPercent.toFixed(1)}% allocated</span>
          <span className={cn('font-semibold', getChangeColor(combinedRealized))}>
            Realized: {combinedRealized >= 0 ? '+' : ''}{formatCurrency(combinedRealized)}
          </span>
        </div>
      )}
    </Card>
  )
}
