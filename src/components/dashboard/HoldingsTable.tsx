import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatPercent, formatChange, getChangeColor, cn } from '@/lib/utils'
import type { PortfolioHolding } from '@/lib/psx/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface HoldingsTableProps {
  holdings: PortfolioHolding[]
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <Card className="text-center py-16">
        <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-400 text-lg">No holdings yet</p>
        <p className="text-zinc-600 text-sm mt-1">
          Add your first transaction to get started
        </p>
      </Card>
    )
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Avg Cost
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Current
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Value
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                P&L
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {holdings.map((holding, i) => (
              <tr
                key={holding.symbol}
                className={cn(
                  'table-row-hover animate-fade-in opacity-0',
                  `stagger-${Math.min(i + 1, 8)}`
                )}
              >
                {/* Stock */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-emerald-400 border border-zinc-700/50 shrink-0">
                      {holding.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        {holding.symbol}
                      </p>
                      <p className="text-xs text-zinc-500 max-w-[150px] truncate">
                        {holding.stock_name}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Quantity */}
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-medium text-zinc-200">
                    {holding.net_quantity}
                  </span>
                </td>

                {/* Avg Cost */}
                <td className="px-4 py-4 text-right">
                  <span className="text-sm text-zinc-300">
                    {formatCurrency(holding.avg_cost)}
                  </span>
                </td>

                {/* Current Price */}
                <td className="px-4 py-4 text-right">
                  <div>
                    <span className="text-sm font-medium text-zinc-200">
                      {formatCurrency(holding.current_price)}
                    </span>
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
                  <span className="text-sm font-semibold text-zinc-100">
                    {formatCurrency(holding.current_value)}
                  </span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
