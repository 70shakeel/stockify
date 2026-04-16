'use client'

import { useMemo, useState, useTransition } from 'react'
import { ArrowDownLeft, ArrowUpRight, Landmark, Trash2 } from 'lucide-react'
import { addInvestment, deleteInvestment } from '@/actions/investments'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, cn } from '@/lib/utils'
import type { InvestmentEntry } from '@/lib/psx/types'

interface InvestmentsTableProps {
  investments: InvestmentEntry[]
}

export function InvestmentsTable({ investments }: InvestmentsTableProps) {
  const [type, setType] = useState<'ADD' | 'WITHDRAW'>('ADD')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const parsedAmount = parseFloat(amount) || 0

  const totals = useMemo(() => {
    return investments.reduce(
      (acc, entry) => {
        if (entry.type === 'ADD') {
          acc.added += Number(entry.amount)
        } else {
          acc.withdrawn += Number(entry.amount)
        }

        return acc
      },
      { added: 0, withdrawn: 0 }
    )
  }, [investments])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await addInvestment({
        type,
        amount: parsedAmount,
        notes: notes.trim() || undefined,
        invested_at: new Date(date).toISOString(),
      })

      if (result.error) {
        setError(result.error)
        return
      }

      setAmount('')
      setDate(new Date().toISOString().split('T')[0])
      setNotes('')
      setType('ADD')
    })
  }

  const handleDelete = (investmentId: string) => {
    if (!confirm('Are you sure you want to delete this investment entry?')) return

    setDeletingId(investmentId)
    startTransition(async () => {
      const result = await deleteInvestment(investmentId)

      if (result.error) {
        setError(result.error)
      }

      setDeletingId(null)
    })
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
      <Card>
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Landmark className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Manage Funds</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Add money to your account or log withdrawals.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 p-1 bg-zinc-800/50 rounded-lg">
            <button
              type="button"
              onClick={() => setType('ADD')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer',
                type === 'ADD'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Add Funds
            </button>
            <button
              type="button"
              onClick={() => setType('WITHDRAW')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer',
                type === 'WITHDRAW'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <ArrowUpRight className="w-4 h-4" />
              Withdraw
            </button>
          </div>

          <Input
            label={type === 'ADD' ? 'Amount Added' : 'Amount Withdrawn'}
            type="number"
            min="0"
            step="0.01"
            placeholder="100000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          <Input
            label="Date"
            type="date"
            value={date}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">
              Notes (optional)
            </label>
            <textarea
              placeholder="e.g. 100000 added to account"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 border-zinc-700/50 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none hover:border-zinc-600 transition-all duration-200 resize-none"
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Total added</span>
              <span className="font-medium text-zinc-100">{formatCurrency(totals.added)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Total withdrawn</span>
              <span className="font-medium text-zinc-100">{formatCurrency(totals.withdrawn)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-zinc-800">
              <span className="text-zinc-400">Net funds</span>
              <span className="font-semibold text-emerald-400">
                {formatCurrency(totals.added - totals.withdrawn)}
              </span>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" isLoading={isPending} className="w-full">
            {type === 'ADD' ? 'Add Investment' : 'Save Withdrawal'}
          </Button>
        </form>
      </Card>

      <Card padding="none" className="overflow-hidden">
        {investments.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Landmark className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400 text-lg">No investment entries yet</p>
            <p className="text-zinc-600 text-sm mt-1">
              Add your first fund entry, like 100000 added to account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Amount</th>
                  <th className="px-5 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {investments.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      'animate-fade-in opacity-0 hover:bg-zinc-800/40 transition-colors',
                      `stagger-${Math.min(i + 1, 8)}`,
                      deletingId === entry.id && 'opacity-50 pointer-events-none'
                    )}
                  >
                    <td className="px-5 py-4">
                      <Badge variant={entry.type === 'ADD' ? 'success' : 'danger'}>
                        {entry.type === 'ADD' ? 'ADDED' : 'WITHDRAWN'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300">
                      {new Date(entry.invested_at).toLocaleDateString('en-PK', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-500 max-w-[320px]">
                      <span className="line-clamp-2">{entry.notes || 'No notes'}</span>
                    </td>
                    <td
                      className={cn(
                        'px-4 py-4 text-right text-sm font-semibold',
                        entry.type === 'ADD' ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {entry.type === 'ADD' ? '+' : '-'}
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry.id)}
                        disabled={isPending}
                        className="text-zinc-500 hover:text-red-400 p-2 h-auto"
                        title="Delete investment entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
