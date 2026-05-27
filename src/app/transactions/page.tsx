import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getPortfolios, getSharedPortfolios } from '@/actions/portfolios'
import { getTransactionsByPortfolioId } from '@/actions/portfolioById'
import { getTransactions } from '@/actions/transactions'
import { TransactionListWrapper } from './TransactionListWrapper'
import { Spinner } from '@/components/ui/Spinner'
import { ClientAddButton } from './ClientAddButton'
import { SeedSymbolsButton } from './SeedSymbolsButton'
import type { Transaction } from '@/lib/psx/types'

export const metadata: Metadata = {
  title: 'Transactions — Stockify',
  description: 'View and manage your buy, sell, and dividend transaction history.',
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

async function TransactionContent({ symbol }: { symbol?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let data: Transaction[] = []
  let error: string | null = null

  if (user) {
    const cookieStore = await cookies()
    const savedId = cookieStore.get('last_portfolio_id')?.value ?? null

    if (savedId) {
      // Validate cookie still belongs to user
      const [{ data: own }, { data: shared }] = await Promise.all([
        getPortfolios(),
        getSharedPortfolios(),
      ])
      const allIds = [...(own ?? []).map(p => p.id), ...(shared ?? []).map(p => p.id)]
      const activeId = allIds.includes(savedId) ? savedId : null

      if (activeId) {
        const result = await getTransactionsByPortfolioId(activeId)
        data = result.data
        error = result.error
        if (symbol) {
          data = data.filter(t => t.symbol === symbol.toUpperCase())
        }
      } else {
        const result = await getTransactions(symbol)
        data = result.data as Transaction[]
        error = result.error
      }
    } else {
      const result = await getTransactions(symbol)
      data = result.data as Transaction[]
      error = result.error
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">
            {symbol ? `Transactions: ${symbol.toUpperCase()}` : 'Transactions'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            {symbol ? `Buy and sell history for ${symbol.toUpperCase()}` : 'Buy and sell transaction history'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SeedSymbolsButton />
          <ClientAddButton />
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <TransactionListWrapper transactions={data} />
    </div>
  )
}

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedParams = await searchParams
  const symbolParam = resolvedParams?.symbol
  const symbol = Array.isArray(symbolParam) ? symbolParam[0] : symbolParam

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        }
        key={symbol}
      >
        <TransactionContent symbol={symbol} />
      </Suspense>
    </div>
  )
}
