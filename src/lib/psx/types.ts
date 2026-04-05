export interface StockData {
  symbol: string
  name: string
  sector: string
  lastPrice: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  open: number
  close: number
  marketCap?: number
  lastUpdated: string
}

export interface StockSearchResult {
  symbol: string
  name: string
  sector: string
  lastPrice: number
  change: number
  changePercent: number
}

export interface PortfolioHolding {
  user_id: string
  symbol: string
  stock_name: string
  sector: string
  current_price: number
  price_change: number
  price_change_percent: number
  net_quantity: number
  avg_cost: number
  total_invested: number
  current_value: number
  unrealized_gain_loss: number
  unrealized_gain_loss_percent: number
  total_fees: number
  transaction_count: number
}

export interface Transaction {
  id: string
  user_id: string
  symbol: string
  type: 'BUY' | 'SELL'
  quantity: number
  price_per_share: number
  fees: number
  notes: string | null
  executed_at: string
  created_at: string
}

export interface TransactionInput {
  symbol: string
  type: 'BUY' | 'SELL'
  quantity: number
  price_per_share: number
  fees?: number
  notes?: string
  executed_at?: string
}

export interface NewsItem {
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  imageUrl?: string
}

export interface PortfolioSummaryData {
  totalInvested: number
  currentValue: number
  totalGainLoss: number
  totalGainLossPercent: number
  totalFees: number
  holdingsCount: number
}
