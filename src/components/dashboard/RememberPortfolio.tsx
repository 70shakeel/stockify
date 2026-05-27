'use client'

import { useEffect } from 'react'
import { setLastViewedPortfolio } from '@/actions/partners'

export function RememberPortfolio({ portfolioId }: { portfolioId: string }) {
  useEffect(() => {
    setLastViewedPortfolio(portfolioId)
  }, [portfolioId])

  return null
}
