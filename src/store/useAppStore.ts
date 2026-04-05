import { create } from 'zustand'

interface AppState {
  // Modal state
  isTransactionModalOpen: boolean
  transactionModalSymbol: string | null
  transactionModalPrice: number | null
  openTransactionModal: (symbol?: string, price?: number) => void
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
  openTransactionModal: (symbol, price) =>
    set({
      isTransactionModalOpen: true,
      transactionModalSymbol: symbol || null,
      transactionModalPrice: price || null,
    }),
  closeTransactionModal: () =>
    set({
      isTransactionModalOpen: false,
      transactionModalSymbol: null,
      transactionModalPrice: null,
    }),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Sidebar
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
}))
