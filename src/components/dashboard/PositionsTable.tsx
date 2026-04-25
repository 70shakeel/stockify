'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatChange, formatCurrency, formatPercent, getChangeColor, cn } from '@/lib/utils'
import type { PortfolioPosition } from '@/lib/psx/types'
import { Briefcase, ChevronDown, ChevronUp } from 'lucide-react'

type SortKey =
  | 'symbol'
  | 'bought_quantity'
  | 'sold_quantity'
  | 'open_quantity'
  | 'avg_buy_cost'
  | 'avg_sale_price'
  | 'current_price'
  | 'realized_gain_loss'
  | 'unrealized_gain_loss'
  | 'total_gain_loss'

type SortOrder = 'asc' | 'desc'

interface PositionsTableProps {
  positions: PortfolioPosition[]
}

function SortIcon({ col, sortBy, sortOrder }: { col: SortKey; sortBy: SortKey; sortOrder: SortOrder }) {
  if (col !== sortBy) {
    return (
      <span className="ml-1 inline-flex flex-col opacity-25">
        <ChevronUp className="w-2.5 h-2.5 -mb-1" />
        <ChevronDown className="w-2.5 h-2.5" />
      </span>
    )
  }

  return sortOrder === 'asc'
    ? <ChevronUp className="ml-1 w-3 h-3 inline text-emerald-400" />
    : <ChevronDown className="ml-1 w-3 h-3 inline text-emerald-400" />
}

export function PositionsTable({ positions }: PositionsTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>('total_gain_loss')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortOrder(current => current === 'asc' ? 'desc' : 'asc')
      return
    }

    setSortBy(col)
    setSortOrder('desc')
  }

  const sorted = useMemo(() => {
    const multiplier = sortOrder === 'asc' ? 1 : -1

    return [...positions].sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]

      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * multiplier
      }

      return ((av as number) - (bv as number)) * multiplier
    })
  }, [positions, sortBy, sortOrder])

  const totals = useMemo(() => {
    return positions.reduce((acc, position) => {
      if (position.status === 'CLOSED') {
        acc.realized += position.realized_gain_loss
      }
      acc.unrealized += position.unrealized_gain_loss
      acc.total += position.total_gain_loss
      acc.taxPaid += position.tax_paid
      return acc
    }, { realized: 0, unrealized: 0, total: 0, taxPaid: 0 })
  }, [positions])

  if (positions.length === 0) {
    return (
      <Card className="text-center py-16">
        <Briefcase className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-400 text-lg">No positions yet</p>
        <p className="text-zinc-600 text-sm mt-1">
          Buy and sell stocks to see realized and unrealized profit or loss here.
        </p>
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
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('bought_quantity')}>
                Bought <SortIcon col="bought_quantity" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('sold_quantity')}>
                Sold <SortIcon col="sold_quantity" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('open_quantity')}>
                Open <SortIcon col="open_quantity" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('avg_buy_cost')}>
                Avg Cost <SortIcon col="avg_buy_cost" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('avg_sale_price')}>
                Avg Sale <SortIcon col="avg_sale_price" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('current_price')}>
                Current <SortIcon col="current_price" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('realized_gain_loss')}>
                Realized P&L <SortIcon col="realized_gain_loss" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Tax (15%)
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('unrealized_gain_loss')}>
                Unrealized P&L <SortIcon col="unrealized_gain_loss" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className={cn(thClass, 'text-right')} onClick={() => handleSort('total_gain_loss')}>
                Total P&L <SortIcon col="total_gain_loss" sortBy={sortBy} sortOrder={sortOrder} />
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {sorted.map((position, i) => (
              <tr
                key={position.symbol}
                className={cn(
                  'animate-fade-in opacity-0 hover:bg-zinc-800/40 transition-colors',
                  `stagger-${Math.min(i + 1, 8)}`
                )}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-emerald-400 border border-zinc-700/50 shrink-0">
                      {position.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{position.symbol}</p>
                      <p className="text-xs text-zinc-500 max-w-[170px] truncate">{position.stock_name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right text-sm text-zinc-200">{position.bought_quantity}</td>
                <td className="px-4 py-4 text-right text-sm text-zinc-200">{position.sold_quantity}</td>
                <td className="px-4 py-4 text-right text-sm font-medium text-zinc-100">{position.open_quantity}</td>
                <td className="px-4 py-4 text-right text-sm text-zinc-300">{formatCurrency(position.avg_buy_cost)}</td>
                <td className="px-4 py-4 text-right text-sm text-zinc-300">
                  {position.sold_quantity > 0 ? formatCurrency(position.avg_sale_price) : '-'}
                </td>
                <td className="px-4 py-4 text-right text-sm text-zinc-300">{formatCurrency(position.current_price)}</td>
                <td className="px-4 py-4 text-right">
                  {position.status === 'CLOSED' ? (
                    <span className={cn('text-sm font-semibold', getChangeColor(position.realized_gain_loss))}>
                      {formatChange(position.realized_gain_loss)}
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-500">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  {position.tax_paid > 0 ? (
                    <span className="text-sm font-semibold text-amber-400">
                      -{formatCurrency(position.tax_paid)}
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <span className={cn('text-sm font-semibold', getChangeColor(position.unrealized_gain_loss))}>
                    {formatChange(position.unrealized_gain_loss)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="space-y-0.5">
                    <p className={cn('text-sm font-semibold', getChangeColor(position.total_gain_loss))}>
                      {formatChange(position.total_gain_loss)}
                    </p>
                    <p className={cn('text-xs', getChangeColor(position.total_gain_loss))}>
                      {formatPercent(position.total_gain_loss_percent)}
                    </p>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <Badge variant={position.status === 'OPEN' ? 'success' : 'default'}>
                    {position.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-800 bg-zinc-950/70">
              <td className="px-5 py-4 text-sm font-semibold text-zinc-100">Total</td>
              <td className="px-4 py-4" />
              <td className="px-4 py-4" />
              <td className="px-4 py-4" />
              <td className="px-4 py-4" />
              <td className="px-4 py-4" />
              <td className="px-4 py-4" />
              <td className="px-4 py-4 text-right">
                <span className={cn('text-sm font-semibold', getChangeColor(totals.realized))}>
                  {formatChange(totals.realized)}
                </span>
              </td>
              <td className="px-4 py-4 text-right">
                {totals.taxPaid > 0 ? (
                  <span className="text-sm font-semibold text-amber-400">
                    -{formatCurrency(totals.taxPaid)}
                  </span>
                ) : (
                  <span className="text-sm text-zinc-600">—</span>
                )}
              </td>
              <td className="px-4 py-4 text-right">
                <span className={cn('text-sm font-semibold', getChangeColor(totals.unrealized))}>
                  {formatChange(totals.unrealized)}
                </span>
              </td>
              <td className="px-4 py-4 text-right">
                <span className={cn('text-sm font-semibold', getChangeColor(totals.total))}>
                  {formatChange(totals.total)}
                </span>
              </td>
              <td className="px-5 py-4" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
