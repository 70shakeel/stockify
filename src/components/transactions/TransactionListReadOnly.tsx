'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, cn } from '@/lib/utils'
import type { Transaction } from '@/lib/psx/types'
import { ArrowUpCircle, ArrowDownCircle, DollarSign, ChevronUp, ChevronDown } from 'lucide-react'

interface Props {
  transactions: Transaction[]
}

type SortBy = 'date' | 'name' | 'price'

export function TransactionListReadOnly({ transactions }: Props) {
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  function handleSort(type: SortBy) {
    if (sortBy === type) {
      setSortOrder(o => o === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(type)
      setSortOrder(type === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = [...transactions].sort((a, b) => {
    const m = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'name') return a.symbol.localeCompare(b.symbol) * m
    if (sortBy === 'price') return ((a.quantity * a.price_per_share) - (b.quantity * b.price_per_share)) * m
    return (new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()) * m
  })

  if (transactions.length === 0) {
    return (
      <Card className="text-center py-16">
        <ArrowUpCircle className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-400 text-lg">No transactions yet</p>
      </Card>
    )
  }

  function typeIcon(t: string, sm = false) {
    const cls = sm ? 'w-4 h-4' : 'w-5 h-5'
    if (t === 'BUY') return <ArrowUpCircle className={cls} />
    if (t === 'SELL') return <ArrowDownCircle className={cls} />
    return <DollarSign className={cls} />
  }

  function typeColor(t: string) {
    if (t === 'BUY') return 'bg-emerald-500/10 text-emerald-400'
    if (t === 'SELL') return 'bg-red-500/10 text-red-400'
    return 'bg-amber-500/10 text-amber-400'
  }

  function badgeVariant(t: string): 'success' | 'danger' | 'warning' {
    if (t === 'BUY') return 'success'
    if (t === 'SELL') return 'danger'
    return 'warning'
  }

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
        <span className="text-sm text-zinc-400 px-2 items-center gap-2 hidden sm:flex">Sort by:</span>
        <div className="flex gap-1 flex-1 sm:flex-none">
          {(['date', 'name', 'price'] as SortBy[]).map(s => (
            <button
              key={s}
              onClick={() => handleSort(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 flex-1 sm:flex-none justify-center sm:justify-start',
                sortBy === s ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {s === 'price' ? <><span className="hidden sm:inline">Total Amount</span><span className="sm:hidden">Amount</span></> : s.charAt(0).toUpperCase() + s.slice(1)}
              {sortBy === s && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers — desktop */}
      <div className="hidden sm:flex items-center gap-4 px-5 text-xs font-medium text-zinc-600 uppercase tracking-wider">
        <div className="w-10 shrink-0" />
        <div className="flex-1">Transaction</div>
        <div className="w-32 text-right shrink-0">Amount</div>
        <div className="w-24 text-right shrink-0">Tax (15%)</div>
        <div className="w-28 text-right shrink-0">P&amp;L (After Tax)</div>
      </div>

      <div className="space-y-2">
        {sorted.map((txn, i) => {
          const isDividend = txn.type === 'DIVIDEND'
          const grossPnl = txn.type === 'SELL' && txn.cost_basis != null
            ? txn.quantity * (txn.price_per_share - txn.cost_basis) - (txn.fees ?? 0)
            : null
          const tax = grossPnl != null && grossPnl > 0 ? grossPnl * 0.15 : 0
          const pnl = grossPnl != null ? grossPnl - tax : null
          const displayAmount = isDividend ? txn.price_per_share : txn.quantity * txn.price_per_share

          return (
            <Card
              key={txn.id}
              padding="none"
              className={cn('animate-fade-in opacity-0', `stagger-${Math.min(i + 1, 8)}`)}
            >
              {/* Desktop */}
              <div className="hidden sm:flex items-center gap-4 px-5 py-4">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', typeColor(txn.type))}>
                  {typeIcon(txn.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{txn.symbol}</span>
                    <span className="text-xs text-zinc-400">•</span>
                    <span className="text-xs text-zinc-400 border border-zinc-700/50 rounded px-1.5 py-0.5">
                      {new Date(txn.executed_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <Badge variant={badgeVariant(txn.type)}>{txn.type}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {isDividend
                      ? `Dividend received: ${formatCurrency(txn.price_per_share)}`
                      : <>{txn.quantity} shares @ {formatCurrency(txn.price_per_share)}{txn.fees > 0 && ` • Fee: ${formatCurrency(txn.fees)}`}</>
                    }
                  </p>
                  {txn.type === 'SELL' && txn.cost_basis != null && (
                    <p className="text-xs text-zinc-600 mt-0.5">Avg cost: {formatCurrency(txn.cost_basis)}/share</p>
                  )}
                  {txn.notes && <p className="text-xs text-zinc-600 mt-1 truncate">{txn.notes}</p>}
                </div>
                <div className="w-32 text-right shrink-0">
                  <p className="text-sm font-semibold text-zinc-100">
                    {isDividend ? '+' : txn.type === 'BUY' ? '-' : '+'}{formatCurrency(displayAmount)}
                  </p>
                </div>
                <div className="w-24 text-right shrink-0">
                  {tax > 0
                    ? <p className="text-sm font-semibold text-amber-400">-{formatCurrency(tax)}</p>
                    : <span className="text-zinc-700 text-sm">—</span>
                  }
                </div>
                <div className="w-28 text-right shrink-0">
                  {isDividend ? (
                    <p className="text-sm font-semibold text-amber-400">+{formatCurrency(txn.price_per_share)}</p>
                  ) : pnl != null ? (
                    <div>
                      <p className={cn('text-sm font-semibold', pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                      </p>
                      <p className={cn('text-xs mt-0.5', pnl >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {pnl >= 0 ? '▲' : '▼'} {Math.abs(((txn.price_per_share - txn.cost_basis!) / txn.cost_basis!) * 100).toFixed(2)}%
                      </p>
                    </div>
                  ) : (
                    <span className="text-zinc-700 text-sm">—</span>
                  )}
                </div>
              </div>

              {/* Mobile */}
              <div className="sm:hidden flex items-center gap-3 px-4 py-3.5">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', typeColor(txn.type))}>
                  {typeIcon(txn.type, true)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-100">{txn.symbol}</span>
                    <Badge variant={badgeVariant(txn.type)}>{txn.type}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isDividend ? 'Dividend' : <>{txn.quantity} × {formatCurrency(txn.price_per_share)}</>}
                    <span className="text-zinc-600"> · </span>
                    {new Date(txn.executed_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn('text-sm font-semibold', isDividend ? 'text-amber-400' : 'text-zinc-100')}>
                    {isDividend ? '+' : txn.type === 'BUY' ? '-' : '+'}{formatCurrency(displayAmount)}
                  </p>
                  {pnl != null && (
                    <p className={cn('text-xs mt-0.5', pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
