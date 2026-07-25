'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { searchStocks } from '@/actions/stocks'
import { useAppStore } from '@/store/useAppStore'
import { formatCurrency, formatChange, formatPercent, getChangeColor, cn } from '@/lib/utils'

interface StockRow {
  symbol: string
  name: string
  sector: string
  last_price: number
  change: number
  change_percent: number
  volume?: number
}

export function StockList() {
  const [stocks, setStocks] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { openTransactionModal } = useAppStore()

  const fetchStocks = useCallback(async (query: string) => {
    setLoading(true)
    const result = await searchStocks(query)
    setStocks(result.data as StockRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStocks(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, fetchStocks])

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4" />
    if (change < 0) return <TrendingDown className="w-4 h-4" />
    return <Minus className="w-4 h-4" />
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Input
          placeholder="Search by symbol, name, or sector..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="w-4 h-4" />}
          className="text-base"
        />
      </div>

      {/* Stock Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : stocks.length === 0 ? (
        <Card className="text-center py-16">
          <Search className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 text-lg">No stocks found</p>
          <p className="text-zinc-600 text-sm mt-1">
            Try a different search term
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            <div className="col-span-4">Stock</div>
            <div className="col-span-2">Sector</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Change</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* Stock Rows */}
          {stocks.map((stock, i) => (
            <Card
              key={stock.symbol}
              hover
              padding="none"
              className={cn(
                'animate-fade-in opacity-0',
                `stagger-${Math.min(i + 1, 8)}`
              )}
            >
              <div className="grid grid-cols-12 gap-4 items-center px-5 py-4">
                {/* Symbol & Name */}
                <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-sm font-bold text-emerald-400 border border-zinc-700/50 shrink-0">
                    {stock.symbol.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">
                      {stock.symbol}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {stock.name}
                    </p>
                  </div>
                </div>

                {/* Sector */}
                <div className="hidden md:block col-span-2">
                  <Badge variant="default">{stock.sector}</Badge>
                </div>

                {/* Price */}
                <div className="col-span-4 md:col-span-2 text-right">
                  <p className="text-sm font-semibold text-zinc-100">
                    {formatCurrency(stock.last_price)}
                  </p>
                </div>

                {/* Change */}
                <div className="col-span-4 md:col-span-2 text-right">
                  <div className={cn('flex items-center justify-end gap-1.5', getChangeColor(stock.change))}>
                    {getChangeIcon(stock.change)}
                    <span className="text-sm font-medium">
                      {formatChange(stock.change)}
                    </span>
                  </div>
                  <p className={cn('text-xs', getChangeColor(stock.change_percent))}>
                    {formatPercent(stock.change_percent)}
                  </p>
                </div>

                {/* Action */}
                <div className="col-span-4 md:col-span-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openTransactionModal(stock.symbol, stock.last_price)}
                  >
                    Trade
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
