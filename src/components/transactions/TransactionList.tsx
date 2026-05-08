'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Transaction } from '@/lib/psx/types'
import { deleteTransaction } from '@/actions/transactions'
import { Trash2, Edit2, ArrowUpCircle, ArrowDownCircle, DollarSign, ChevronUp, ChevronDown } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useAppStore } from '@/store/useAppStore'

interface TransactionListProps {
  transactions: Transaction[]
}

export function TransactionList({ transactions }: TransactionListProps) {
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'price'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  const openEditTransactionModal = useAppStore(state => state.openEditTransactionModal)

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return
    setDeletingId(id)
    startTransition(async () => {
      await deleteTransaction(id)
      setDeletingId(null)
    })
  }

  const handleSort = (type: 'date' | 'name' | 'price') => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(type)
      setSortOrder(type === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedTransactions = [...transactions].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1
    
    if (sortBy === 'name') {
      return a.symbol.localeCompare(b.symbol) * multiplier
    }
    if (sortBy === 'price') {
      const aTotal = a.price_per_share * a.quantity
      const bTotal = b.price_per_share * b.quantity
      return (aTotal - bTotal) * multiplier
    }
    // Default to date
    return (new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()) * multiplier
  })

  if (transactions.length === 0) {
    return (
      <Card className="text-center py-16">
        <ArrowUpCircle className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-400 text-lg">No transactions yet</p>
        <p className="text-zinc-600 text-sm mt-1">
          Start by adding your first buy, sell, or dividend transaction
        </p>
      </Card>
    )
  }

  function getTypeIcon(txnType: string) {
    switch (txnType) {
      case 'BUY':
        return <ArrowUpCircle className="w-5 h-5" />
      case 'SELL':
        return <ArrowDownCircle className="w-5 h-5" />
      case 'DIVIDEND':
        return <DollarSign className="w-5 h-5" />
      default:
        return <ArrowUpCircle className="w-5 h-5" />
    }
  }

  function getTypeIconSmall(txnType: string) {
    switch (txnType) {
      case 'BUY':
        return <ArrowUpCircle className="w-4 h-4" />
      case 'SELL':
        return <ArrowDownCircle className="w-4 h-4" />
      case 'DIVIDEND':
        return <DollarSign className="w-4 h-4" />
      default:
        return <ArrowUpCircle className="w-4 h-4" />
    }
  }

  function getTypeColor(txnType: string) {
    switch (txnType) {
      case 'BUY':
        return 'bg-emerald-500/10 text-emerald-400'
      case 'SELL':
        return 'bg-red-500/10 text-red-400'
      case 'DIVIDEND':
        return 'bg-amber-500/10 text-amber-400'
      default:
        return 'bg-zinc-500/10 text-zinc-400'
    }
  }

  function getBadgeVariant(txnType: string): 'success' | 'danger' | 'warning' {
    switch (txnType) {
      case 'BUY': return 'success'
      case 'SELL': return 'danger'
      case 'DIVIDEND': return 'warning'
      default: return 'success'
    }
  }

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
        <span className="text-sm text-zinc-400 px-2 items-center gap-2 hidden sm:flex">
          Sort by:
        </span>
        <div className="flex gap-1 flex-1 sm:flex-none">
          <button
            onClick={() => handleSort('date')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 flex-1 sm:flex-none justify-center sm:justify-start",
              sortBy === 'date' ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Date
            {sortBy === 'date' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>
          <button
            onClick={() => handleSort('name')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 flex-1 sm:flex-none justify-center sm:justify-start",
              sortBy === 'name' ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Name
            {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>
          <button
            onClick={() => handleSort('price')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1 flex-1 sm:flex-none justify-center sm:justify-start",
              sortBy === 'price' ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span className="hidden sm:inline">Total Amount</span>
            <span className="sm:hidden">Amount</span>
            {sortBy === 'price' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>
        </div>
      </div>

      {/* Column Headers — desktop only */}
      <div className="hidden sm:flex items-center gap-4 px-5 text-xs font-medium text-zinc-600 uppercase tracking-wider">
        <div className="w-10 shrink-0" />
        <div className="flex-1">Transaction</div>
        <div className="w-32 text-right shrink-0">Amount</div>
        <div className="w-24 text-right shrink-0">Tax (15%)</div>
        <div className="w-28 text-right shrink-0">P&amp;L (After Tax)</div>
        <div className="w-16 shrink-0" />
      </div>

      <div className="space-y-2">
        {sortedTransactions.map((txn, i) => {
          const isDividend = txn.type === 'DIVIDEND'
          const grossPnl = txn.type === 'SELL' && txn.cost_basis != null
            ? txn.quantity * (txn.price_per_share - txn.cost_basis) - (txn.fees ?? 0)
            : null
          const tax = grossPnl != null && grossPnl > 0 ? grossPnl * 0.15 : 0
          const pnl = grossPnl != null ? grossPnl - tax : null

          // For dividends, the "amount" is just price_per_share (total dividend)
          const displayAmount = isDividend
            ? txn.price_per_share
            : txn.quantity * txn.price_per_share

          return (
          <Card
            key={txn.id}
            padding="none"
            className={cn(
              'animate-fade-in opacity-0',
              `stagger-${Math.min(i + 1, 8)}`,
              deletingId === txn.id && 'opacity-50 pointer-events-none'
            )}
          >
            {/* Desktop layout */}
            <div className="hidden sm:flex items-center gap-4 px-5 py-4">
              {/* Type Icon */}
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  getTypeColor(txn.type)
                )}
              >
                {getTypeIcon(txn.type)}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">
                    {txn.symbol}
                  </span>
                  <span className="text-xs text-zinc-400">•</span>
                  <span className="text-xs text-zinc-400 border border-zinc-700/50 rounded px-1.5 py-0.5">
                    {new Date(txn.executed_at).toLocaleDateString('en-PK', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                  <Badge variant={getBadgeVariant(txn.type)}>
                    {txn.type}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {isDividend
                    ? `Dividend received: ${formatCurrency(txn.price_per_share)}`
                    : (
                      <>
                        {txn.quantity} shares @ {formatCurrency(txn.price_per_share)}
                        {txn.fees > 0 && ` • Fee: ${formatCurrency(txn.fees)}`}
                      </>
                    )
                  }
                </p>
                {txn.type === 'SELL' && txn.cost_basis != null && (
                  <p className="text-xs text-zinc-600 mt-0.5">
                    Avg cost: {formatCurrency(txn.cost_basis)}/share
                  </p>
                )}
                {txn.notes && (
                  <p className="text-xs text-zinc-600 mt-1 truncate">{txn.notes}</p>
                )}
              </div>

              {/* Amount */}
              <div className="w-32 text-right shrink-0">
                <p className="text-sm font-semibold text-zinc-100">
                  {isDividend ? '+' : txn.type === 'BUY' ? '-' : '+'}{formatCurrency(displayAmount)}
                </p>
              </div>

              {/* Tax */}
              <div className="w-24 text-right shrink-0">
                {tax > 0 ? (
                  <p className="text-sm font-semibold text-amber-400">
                    -{formatCurrency(tax)}
                  </p>
                ) : (
                  <span className="text-zinc-700 text-sm">—</span>
                )}
              </div>

              {/* P&L (after tax) or Dividend income */}
              <div className="w-28 text-right shrink-0">
                {isDividend ? (
                  <p className="text-sm font-semibold text-amber-400">
                    +{formatCurrency(txn.price_per_share)}
                  </p>
                ) : pnl != null ? (
                  <div>
                    <p className={cn(
                      'text-sm font-semibold',
                      pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                    </p>
                    <p className={cn(
                      'text-xs mt-0.5',
                      pnl >= 0 ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {pnl >= 0 ? '▲' : '▼'} {Math.abs(((txn.price_per_share - txn.cost_basis!) / txn.cost_basis!) * 100).toFixed(2)}%
                    </p>
                  </div>
                ) : (
                  <span className="text-zinc-700 text-sm">—</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 ml-2 border-l border-zinc-800 pl-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditTransactionModal(txn)}
                  disabled={isPending}
                  className="text-zinc-500 hover:text-emerald-400 p-2 h-auto"
                  title="Edit Transaction"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(txn.id)}
                  disabled={isPending}
                  className="text-zinc-500 hover:text-red-400 p-2 h-auto"
                  title="Delete Transaction"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Mobile layout */}
            <div className="sm:hidden flex items-center gap-3 px-4 py-3.5">
              {/* Type Icon */}
              <div
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  getTypeColor(txn.type)
                )}
              >
                {getTypeIconSmall(txn.type)}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-zinc-100">
                    {txn.symbol}
                  </span>
                  <Badge variant={getBadgeVariant(txn.type)}>
                    {txn.type}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {isDividend
                    ? `Dividend`
                    : (
                      <>
                        {txn.quantity} × {formatCurrency(txn.price_per_share)}
                      </>
                    )
                  }
                  <span className="text-zinc-600"> · </span>
                  {new Date(txn.executed_at).toLocaleDateString('en-PK', {
                    day: 'numeric',
                    month: 'short',
                    year: '2-digit'
                  })}
                </p>
              </div>

              {/* Amount + Actions */}
              <div className="shrink-0 flex flex-col items-end gap-1">
                <p className={cn(
                  "text-sm font-semibold",
                  isDividend ? "text-amber-400" : "text-zinc-100"
                )}>
                  {isDividend ? '+' : txn.type === 'BUY' ? '-' : '+'}{formatCurrency(displayAmount)}
                </p>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditTransactionModal(txn)}
                    disabled={isPending}
                    className="text-zinc-500 hover:text-emerald-400 p-1.5 h-auto"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(txn.id)}
                    disabled={isPending}
                    className="text-zinc-500 hover:text-red-400 p-1.5 h-auto"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          )
        })}
      </div>
    </div>
  )
}
