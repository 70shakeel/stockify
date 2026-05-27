'use client'

import { useEffect } from 'react'
import { setLastViewedPortfolio } from '@/actions/partners'
import { useAppStore } from '@/store/useAppStore'

export function RememberPortfolio({ portfolioId }: { portfolioId: string }) {
  const setActivePortfolioId = useAppStore(s => s.setActivePortfolioId)

  useEffect(() => {
    setLastViewedPortfolio(portfolioId)
    setActivePortfolioId(portfolioId)
  }, [portfolioId, setActivePortfolioId])

  return null
}
