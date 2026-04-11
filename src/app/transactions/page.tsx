import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTransactions } from '@/actions/transactions'
import { TransactionListWrapper } from './TransactionListWrapper'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import type { Transaction } from '@/lib/psx/types'

export const metadata: Metadata = {
  title: 'Transactions — Stockify',
  description: 'View and manage your buy/sell transaction history.',
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

async function TransactionContent({ symbol }: { symbol?: string }) {
  const { data, error } = await getTransactions(symbol)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">
            {symbol ? `Transactions: ${symbol.toUpperCase()}` : 'Transactions'}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {symbol ? `Your buy and sell history for ${symbol.toUpperCase()}` : 'Your buy and sell transaction history'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SeedSymbolsButton />
          <TransactionAddButton />
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <TransactionListWrapper transactions={data as Transaction[]} />
    </div>
  )
}

function TransactionAddButton() {
  return <AddTransactionBtn />
}

function AddTransactionBtn() {
  return (
    <ClientAddButton />
  )
}

import { ClientAddButton } from './ClientAddButton'
import { SeedSymbolsButton } from './SeedSymbolsButton'

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
