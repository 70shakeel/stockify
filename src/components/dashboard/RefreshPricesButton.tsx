'use client'

import { Button } from '@/components/ui/Button'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { refreshPortfolioPrices } from '@/actions/stocks'

interface Props {
  portfolioId?: string
}

export function RefreshPricesButton({ portfolioId }: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (!portfolioId) return
    setIsRefreshing(true)
    await refreshPortfolioPrices(portfolioId)
    setIsRefreshing(false)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="text-zinc-400 hover:text-emerald-400 flex items-center gap-1.5"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh Prices'}</span>
    </Button>
  )
}
