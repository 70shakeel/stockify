'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatPercent, formatChange, getChangeColor, cn } from '@/lib/utils'
import type { PortfolioHolding } from '@/lib/psx/types'
import { TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

type SortKey = 'symbol' | 'net_quantity' | 'avg_cost' | 'current_price' | 'current_value' | 'unrealized_gain_loss_percent'
type SortOrder = 'asc' | 'desc'

interface HoldingsTableProps {
  holdings: PortfolioHolding[]
}

function SortIcon({ col, sortBy, sortOrder }: { col: SortKey; sortBy: SortKey; sortOrder: SortOrder }) {
  if (col !== sortBy) {
    return <span className="ml-1 inline-flex flex-col opacity-25"><ChevronUp className="w-2.5 h-2.5 -mb-1" /><ChevronDown className="w-2.5 h-2.5" /></span>
  }
  return sortOrder === 'asc'
    ? <ChevronUp className="ml-1 w-3 h-3 inline text-emerald-400" />
    : <ChevronDown className="ml-1 w-3 h-3 inline text-emerald-400" />
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const router = useRouter()
  const openTransactionModal = useAppStore((s) => s.openTransactionModal)
  const [sortBy, setSortBy] = useState<SortKey>('current_value')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortOrder('desc')
    }
  }

  const sorted = useMemo(() => {
    const mult = sortOrder === 'asc' ? 1 : -1
    return [...holdings].sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * mult
      }
      return ((av as number) - (bv as number)) * mult
    })
  }, [holdings, sortBy, sortOrder])

  if (holdings.length === 0) {
    return (
      <Card className="text-center py-16">
        <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-400 text-lg">No holdings yet</p>
        <p className="text-zinc-600 text-sm mt-1">Add your first transaction to get started</p>
      </Card>
    )
  }

  const thClass = 'px-4 py-3.5 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-300 transition-colors'

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className={cn(thClass, 'px-5 text-left')} onClick={() => handleSort('symbol')}>
                Stock <SortIcon col="symbol" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('net_quantity')}>
                Qty <SortIcon col="net_quantity" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('avg_cost')}>
                Avg Cost <SortIcon col="avg_cost" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('current_price')}>
                Current <SortIcon col="current_price" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('current_value')}>
                Value <SortIcon col="current_value" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'px-5 text-right')} onClick={() => handleSort('unrealized_gain_loss_percent')}>
                P&L % <SortIcon col="unrealized_gain_loss_percent" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'px-5 text-right')}>
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sorted.map((holding, i) => (
              <tr
                key={holding.symbol}
                onClick={() => router.push(`/transactions?symbol=${holding.symbol}`)}
                className={cn(
                  'animate-fade-in opacity-0 cursor-pointer transition-colors hover:bg-zinc-800/60',
                  `stagger-${Math.min(i + 1, 8)}`
                )}
                title={`View transactions for ${holding.symbol}`}
              >
                {/* Stock */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-emerald-400 border border-zinc-700/50 shrink-0">
                      {holding.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{holding.symbol}</p>
                      <p className="text-xs text-zinc-500 max-w-[150px] truncate">{holding.stock_name}</p>
                    </div>
                  </div>
                </td>

                {/* Quantity */}
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-medium text-zinc-200">{holding.net_quantity}</span>
                </td>

                {/* Avg Cost */}
                <td className="px-4 py-4 text-right">
                  <span className="text-sm text-zinc-300">{formatCurrency(holding.avg_cost)}</span>
                </td>

                {/* Current Price */}
                <td className="px-4 py-4 text-right">
                  <div>
                    <span className="text-sm font-medium text-zinc-200">{formatCurrency(holding.current_price)}</span>
                    <div className={cn('flex items-center justify-end gap-1 text-xs mt-0.5', getChangeColor(holding.price_change))}>
                      {holding.price_change > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : holding.price_change < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <Minus className="w-3 h-3" />
                      )}
                      {formatChange(holding.price_change)}
                    </div>
                  </div>
                </td>

                {/* Value */}
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-semibold text-zinc-100">{formatCurrency(holding.current_value)}</span>
                </td>

                {/* P&L */}
                <td className="px-5 py-4 text-right">
                  <div>
                    <span className={cn('text-sm font-semibold', getChangeColor(holding.unrealized_gain_loss))}>
                      {formatChange(holding.unrealized_gain_loss)}
                    </span>
                    <div className="mt-0.5">
                      <Badge
                        variant={
                          holding.unrealized_gain_loss_percent > 0
                            ? 'success'
                            : holding.unrealized_gain_loss_percent < 0
                              ? 'danger'
                              : 'default'
                        }
                      >
                        {formatPercent(holding.unrealized_gain_loss_percent)}
                      </Badge>
                    </div>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-5 py-4 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={(e) => {
                      e.stopPropagation()
                      openTransactionModal(holding.symbol, holding.current_price)
                    }}
                  >
                    Trade
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
