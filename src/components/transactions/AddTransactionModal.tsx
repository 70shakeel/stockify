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
  const [feeType, setFeeType] = useState<'PKR' | '%'>('%')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
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
    setFeeType('%')
    setDate(new Date().toISOString().split('T')[0])
    setNotes('')
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    closeTransactionModal()
  }

  const parsedQty = parseInt(quantity) || 0
  const parsedPrice = parseFloat(price) || 0
  const rawFee = parseFloat(fees) || 0

  const calculatedFee = feeType === '%' 
    ? (parsedQty * parsedPrice) * (rawFee / 100)
    : rawFee

  const totalCost = (parsedQty * parsedPrice) + calculatedFee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const txnData = {
      symbol: symbol.toUpperCase(),
      type,
      quantity: parsedQty,
      price_per_share: parsedPrice,
      fees: calculatedFee,
      notes: notes || undefined,
      executed_at: new Date(date).toISOString(),
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
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">
            Fees / Commission (optional)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                placeholder={feeType === '%' ? "0.15" : "0.00"}
                step="0.01"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                className="w-full rounded-lg border bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 border-zinc-700/50 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none hover:border-zinc-600 transition-all duration-200"
              />
            </div>
            <div className="flex bg-zinc-800/50 p-1 rounded-lg border border-zinc-700/50">
              <button
                type="button"
                onClick={() => setFeeType('PKR')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  feeType === 'PKR' ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                PKR
              </button>
              <button
                type="button"
                onClick={() => setFeeType('%')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  feeType === '%' ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                %
              </button>
            </div>
          </div>
          {feeType === '%' && rawFee > 0 && parsedQty > 0 && parsedPrice > 0 && (
            <p className="text-xs text-emerald-400/80 mt-1">
              Calculated fee: {formatCurrency(calculatedFee)}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => { setFeeType('%'); setFees('0.15') }}
              className="text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              0.15% (Standard Fee)
            </button>
          </div>
        </div>

        {/* Date */}
        <Input
          label="Transaction Date"
          type="date"
          value={date}
          max={new Date().toISOString().split('T')[0]} // Prevent future dates
          onChange={(e) => setDate(e.target.value)}
          required
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
