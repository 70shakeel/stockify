import type { Metadata } from 'next'
import { StockList } from '@/components/stocks/StockList'

export const metadata: Metadata = {
  title: 'Stocks — Stockify',
  description: 'Browse and search all Pakistan Stock Exchange listed companies with live prices.',
}

export default function StocksPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">PSX Stocks</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Browse and search Pakistan Stock Exchange listed companies
          </p>
        </div>

        <StockList />
      </div>
    </div>
  )
}
