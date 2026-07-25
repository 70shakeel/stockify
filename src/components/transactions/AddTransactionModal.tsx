'use client'

import { useState, useEffect, useCallback, useOptimistic, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/store/useAppStore'
import { updateTransaction, addTransaction } from '@/actions/transactions'
import { searchStocks } from '@/actions/stocks'
import { ArrowUpCircle, ArrowDownCircle, DollarSign, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface OptimisticTransaction {
  id?: string
  symbol: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price_per_share: number
  status: 'pending' | 'success' | 'error'
}

export function AddTransactionModal() {
  const {
    isTransactionModalOpen,
    transactionModalSymbol,
    transactionModalPrice,
    editingTransaction,
    closeTransactionModal,
    activePortfolioId,
  } = useAppStore()

  const [type, setType] = useState<'BUY' | 'SELL' | 'DIVIDEND'>('BUY')
  const [symbol, setSymbol] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('')
  const [feeType, setFeeType] = useState<'PKR' | '%'>('%')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [optimisticTxns, addOptimisticTxn] = useOptimistic<
    OptimisticTransaction[],
    OptimisticTransaction
  >([], (state, newTxn) => {
    // If editing, we could replace it, but optimistic UI for edit in a modal list is tricky.
    // For simplicity, we just track the pending state globally.
    return [...state, newTxn]
  })

  // Auto-fill when modal opens
  useEffect(() => {
    if (isTransactionModalOpen) {
      if (editingTransaction) {
        setType(editingTransaction.type as 'BUY' | 'SELL' | 'DIVIDEND')
        setSymbol(editingTransaction.symbol)
        setQuantity(editingTransaction.quantity.toString())
        setPrice(editingTransaction.price_per_share.toString())
        setFees(editingTransaction.fees.toString())
        setFeeType('PKR')
        setDate(new Date(editingTransaction.executed_at).toISOString().split('T')[0])
        setNotes(editingTransaction.notes || '')
      } else {
        resetForm()
        if (transactionModalSymbol) setSymbol(transactionModalSymbol)
        if (transactionModalPrice) setPrice(transactionModalPrice.toString())
      }
    }
  }, [isTransactionModalOpen, editingTransaction, transactionModalSymbol, transactionModalPrice])

  // Search autocomplete
  useEffect(() => {
    if (!symbol || symbol.length < 1 || editingTransaction) {
      setSuggestions([])
      return
    }
    const timeout = setTimeout(async () => {
      setIsSearching(true)
      const res = await searchStocks(symbol)
      if (!res.error) setSuggestions(res.data)
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [symbol, editingTransaction])

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

  const handleClose = useCallback(() => {
    resetForm()
    closeTransactionModal()
  }, [closeTransactionModal])

  const isDividend = type === 'DIVIDEND'
  const parsedQty = isDividend ? 1 : (parseInt(quantity) || 0)
  const parsedPrice = parseFloat(price) || 0
  const rawFee = parseFloat(fees) || 0

  const calculatedFee = isDividend
    ? 0
    : feeType === '%' 
      ? (parsedQty * parsedPrice) * (rawFee / 100)
      : rawFee

  const totalCost = isDividend
    ? parsedPrice
    : (parsedQty * parsedPrice) + calculatedFee

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const txnData = {
      symbol: symbol.toUpperCase(),
      type,
      quantity: isDividend ? 1 : parsedQty,
      price_per_share: parsedPrice,
      fees: isDividend ? 0 : calculatedFee,
      notes: notes || undefined,
      executed_at: new Date(date).toISOString(),
      portfolio_id: activePortfolioId ?? undefined,
    }

    startTransition(async () => {
      addOptimisticTxn({
        ...txnData,
        status: 'pending',
      })

      const result = editingTransaction
        ? await updateTransaction(editingTransaction.id, txnData)
        : await addTransaction(txnData)

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
      title={editingTransaction ? "Edit Transaction" : "Add Transaction"}
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
          <button
            type="button"
            onClick={() => setType('DIVIDEND')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
              type === 'DIVIDEND'
                ? 'bg-amber-500/15 text-amber-400 shadow-sm border border-amber-500/20'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            DIVIDEND
          </button>
        </div>

        {/* Symbol with Autocomplete */}
        <div className="relative">
          <Input
            label="Stock Symbol"
            placeholder="e.g. OGDC, HBL, SYS"
            value={symbol || transactionModalSymbol || ''}
            onChange={(e) => {
              setSymbol(e.target.value.toUpperCase())
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            required
            autoComplete="off"
          />
          
          {showSuggestions && symbol.length >= 1 && !editingTransaction && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl z-50">
              {isSearching ? (
                <div className="p-3 text-sm text-zinc-500 text-center flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  Searching local cache...
                </div>
              ) : suggestions.length > 0 ? (
                <div className="py-1">
                  {suggestions.map((stock) => (
                    <button
                      key={stock.symbol}
                      type="button"
                      onClick={() => {
                        setSymbol(stock.symbol)
                        if (!isDividend && stock.last_price > 0) {
                          setPrice(stock.last_price.toString())
                        }
                        setShowSuggestions(false)
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-zinc-800 focus:bg-zinc-800 transition-colors flex flex-col cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-zinc-100 flex items-center justify-between">
                        {stock.symbol}
                        <span className="text-xs text-emerald-400">{formatCurrency(stock.last_price)}</span>
                      </span>
                      <span className="text-xs text-zinc-500 truncate">{stock.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center flex flex-col items-center">
                  <span className="text-sm font-medium text-emerald-400 mb-1">New Symbol: {symbol}</span>
                  <span className="text-xs text-zinc-500 leading-relaxed max-w-[200px]">
                    Not found in local cache. Proceed to save and our backend will fetch {symbol} live from the PSX portal.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quantity + Price (or just Dividend Amount) */}
        {isDividend ? (
          <Input
            label="Dividend Amount (PKR)"
            type="number"
            placeholder="e.g. 5000"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        ) : (
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
        )}

        {/* Fees — hidden for dividends */}
        {!isDividend && (
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
        )}

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
            placeholder={isDividend ? "e.g. Q1 2025 dividend payout" : "Add any notes about this transaction..."}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 border-zinc-700/50 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none hover:border-zinc-600 transition-all duration-200 resize-none"
          />
        </div>

        {/* Total Summary */}
        {price && (isDividend || quantity) && (
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
            <span className="text-sm text-zinc-400">
              {isDividend ? 'Dividend Income' : type === 'BUY' ? 'Total Cost' : 'Total Proceeds'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-zinc-100">
                {formatCurrency(totalCost)}
              </span>
              <Badge variant={isDividend ? 'warning' : type === 'BUY' ? 'success' : 'danger'}>
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
            variant={isDividend ? 'primary' : type === 'BUY' ? 'primary' : 'danger'}
            isLoading={isPending}
            className="flex-1"
          >
            {editingTransaction 
              ? 'Save Changes' 
              : isDividend ? 'Record Dividend' : type === 'BUY' ? 'Buy Shares' : 'Sell Shares'
            }
          </Button>
        </div>
      </form>
    </Modal>
  )
}
