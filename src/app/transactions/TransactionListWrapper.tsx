'use client'

import { TransactionList } from '@/components/transactions/TransactionList'
import type { Transaction } from '@/lib/psx/types'

export function TransactionListWrapper({ transactions }: { transactions: Transaction[] }) {
  return <TransactionList transactions={transactions} />
}
