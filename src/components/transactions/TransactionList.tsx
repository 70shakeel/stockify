'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Transaction } from '@/lib/psx/types'
import { deleteTransaction } from '@/actions/transactions'
import { Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useState, useTransition } from 'react'

interface TransactionListProps {
  transactions: Transaction[]
}

export function TransactionList({ transactions }: TransactionListProps) {
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return
    setDeletingId(id)
    startTransition(async () => {
      await deleteTransaction(id)
      setDeletingId(null)
    })
  }

  if (transactions.length === 0) {
    return (
      <Card className="text-center py-16">
        <ArrowUpCircle className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-400 text-lg">No transactions yet</p>
        <p className="text-zinc-600 text-sm mt-1">
          Start by adding your first buy or sell transaction
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {transactions.map((txn, i) => (
        <Card
          key={txn.id}
          padding="none"
          className={cn(
            'animate-fade-in opacity-0',
            `stagger-${Math.min(i + 1, 8)}`,
            deletingId === txn.id && 'opacity-50 pointer-events-none'
          )}
        >
          <div className="flex items-center gap-4 px-5 py-4">
            {/* Type Icon */}
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                txn.type === 'BUY'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}
            >
              {txn.type === 'BUY' ? (
                <ArrowUpCircle className="w-5 h-5" />
              ) : (
                <ArrowDownCircle className="w-5 h-5" />
              )}
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
                <Badge
                  variant={txn.type === 'BUY' ? 'success' : 'danger'}
                >
                  {txn.type}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {txn.quantity} shares @ {formatCurrency(txn.price_per_share)}
                {txn.fees > 0 && ` • Fee: ${formatCurrency(txn.fees)}`}
              </p>
              {txn.notes && (
                <p className="text-xs text-zinc-600 mt-1 truncate">
                  {txn.notes}
                </p>
              )}
            </div>

            {/* Amount + Date */}
            <div className="text-right shrink-0">
              <p className={cn(
                'text-sm font-semibold',
                txn.type === 'BUY' ? 'text-zinc-100' : 'text-red-400'
              )}>
                {txn.type === 'BUY' ? '-' : '+'}{formatCurrency(txn.quantity * txn.price_per_share)}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5" title={new Date(txn.executed_at).toLocaleTimeString()}>
                {new Date(txn.executed_at).toLocaleDateString('en-PK', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(txn.id)}
              disabled={isPending}
              className="text-zinc-600 hover:text-red-400 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
