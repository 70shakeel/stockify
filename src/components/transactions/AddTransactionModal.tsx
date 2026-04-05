'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/store/useAppStore'
import { addTransaction } from '@/actions/transactions'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface OptimisticTransaction {
  symbol: string
  type: 'BUY' | 'SELL'
  quantity: number
  price_per_share: number
  status: 'pending' | 'success' | 'error'
}

export function AddTransactionModal() {
  const {
    isTransactionModalOpen,
    transactionModalSymbol,
    transactionModalPrice,
    closeTransactionModal,
  } = useAppStore()

  const [type, setType] = useState<'BUY' | 'SELL'>('BUY')
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [optimisticTxns, addOptimisticTxn] = useOptimistic<
    OptimisticTransaction[],
    OptimisticTransaction
  >([], (state, newTxn) => [...state, newTxn])

  // Auto-fill when modal opens with symbol/price
  useState(() => {
    if (transactionModalSymbol) setSymbol(transactionModalSymbol)
    if (transactionModalPrice) setPrice(transactionModalPrice.toString())
  })

  const resetForm = () => {
    setType('BUY')
    setSymbol('')
    setQuantity('')
    setPrice('')
    setFees('')
    setNotes('')
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    closeTransactionModal()
  }

  const totalCost = (parseFloat(quantity) || 0) * (parseFloat(price) || 0) + (parseFloat(fees) || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const txnData = {
      symbol: symbol.toUpperCase(),
      type,
      quantity: parseInt(quantity),
      price_per_share: parseFloat(price),
      fees: parseFloat(fees) || 0,
      notes: notes || undefined,
    }

    startTransition(async () => {
      // Optimistic update
      addOptimisticTxn({
        ...txnData,
        status: 'pending',
      })

      const result = await addTransaction(txnData)

      if (result.error) {
        setError(result.error)
      } else {
        handleClose()
      }
    })
  }

  return (
    <Modal
      isOpen={isTransactionModalOpen}
      onClose={handleClose}
      title="Add Transaction"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Transaction Type Toggle */}
        <div className="flex gap-2 p-1 bg-zinc-800/50 rounded-lg">
          <button
            type="button"
            onClick={() => setType('BUY')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
              type === 'BUY'
                ? 'bg-emerald-500/15 text-emerald-400 shadow-sm border border-emerald-500/20'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            BUY
          </button>
          <button
            type="button"
            onClick={() => setType('SELL')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
              type === 'SELL'
                ? 'bg-red-500/15 text-red-400 shadow-sm border border-red-500/20'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            SELL
          </button>
        </div>

        {/* Symbol */}
        <Input
          label="Stock Symbol"
          placeholder="e.g. OGDC, HBL, SYS"
          value={symbol || transactionModalSymbol || ''}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          required
        />

        {/* Quantity + Price */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            type="number"
            placeholder="100"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Input
            label="Price per Share"
            type="number"
            placeholder="95.50"
            step="0.01"
            min="0"
            value={price || transactionModalPrice?.toString() || ''}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        {/* Fees */}
        <Input
          label="Fees / Commission (optional)"
          type="number"
          placeholder="0.00"
          step="0.01"
          min="0"
          value={fees}
          onChange={(e) => setFees(e.target.value)}
        />

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">
            Notes (optional)
          </label>
          <textarea
            placeholder="Add any notes about this transaction..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 border-zinc-700/50 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none hover:border-zinc-600 transition-all duration-200 resize-none"
          />
        </div>

        {/* Total Summary */}
        {quantity && price && (
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
            <span className="text-sm text-zinc-400">
              Total {type === 'BUY' ? 'Cost' : 'Proceeds'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-zinc-100">
                {formatCurrency(totalCost)}
              </span>
              <Badge variant={type === 'BUY' ? 'success' : 'danger'}>
                {type}
              </Badge>
            </div>
          </div>
        )}

        {/* Optimistic pending indicator */}
        {optimisticTxns.some((t) => t.status === 'pending') && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Processing transaction...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={type === 'BUY' ? 'primary' : 'danger'}
            isLoading={isPending}
            className="flex-1"
          >
            {type === 'BUY' ? 'Buy Shares' : 'Sell Shares'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
