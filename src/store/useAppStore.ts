import { create } from 'zustand'
import type { Transaction } from '@/lib/psx/types'

interface AppState {
  // Modal state
  isTransactionModalOpen: boolean
  transactionModalSymbol: string | null
  transactionModalPrice: number | null
  editingTransaction: Transaction | null
  openTransactionModal: (symbol?: string, price?: number) => void
  openEditTransactionModal: (txn: Transaction) => void
  closeTransactionModal: () => void

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Sidebar
  isSidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // Transaction Modal
  isTransactionModalOpen: false,
  transactionModalSymbol: null,
  transactionModalPrice: null,
  editingTransaction: null,
  openTransactionModal: (symbol, price) =>
    set({
      isTransactionModalOpen: true,
      transactionModalSymbol: symbol || null,
      transactionModalPrice: price || null,
      editingTransaction: null,
    }),
  openEditTransactionModal: (txn) =>
    set({
      isTransactionModalOpen: true,
      editingTransaction: txn,
      transactionModalSymbol: null,
      transactionModalPrice: null,
    }),
  closeTransactionModal: () =>
    set({
      isTransactionModalOpen: false,
      transactionModalSymbol: null,
      transactionModalPrice: null,
      editingTransaction: null,
    }),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Sidebar
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
}))
