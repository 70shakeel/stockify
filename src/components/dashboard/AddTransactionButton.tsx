'use client'

import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store/useAppStore'
import { Plus } from 'lucide-react'

export function AddTransactionButton() {
  const { openTransactionModal } = useAppStore()

  return (
    <Button onClick={() => openTransactionModal()} size="md">
      <Plus className="w-4 h-4" />
      Add Transaction
    </Button>
  )
}
