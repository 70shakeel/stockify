'use client'

import { Button } from '@/components/ui/Button'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function RefreshPricesButton() {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    // Give it a moment so the user sees the spinner
    setTimeout(() => setIsRefreshing(false), 2000)
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
