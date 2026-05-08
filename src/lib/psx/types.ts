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

export interface PortfolioPosition {
  symbol: string
  stock_name: string
  current_price: number
  bought_quantity: number
  sold_quantity: number
  open_quantity: number
  avg_buy_cost: number
  avg_sale_price: number
  avg_open_cost: number
  total_buy_cost: number
  total_sale_value: number
  invested_amount: number
  realized_proceeds: number
  realized_gain_loss: number
  tax_paid: number
  unrealized_gain_loss: number
  total_gain_loss: number
  total_gain_loss_percent: number
  total_fees: number
  status: 'OPEN' | 'CLOSED'
}

export interface Transaction {
  id: string
  user_id: string
  symbol: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price_per_share: number
  fees: number
  /** Weighted avg cost per share at the time of the sell; null for BUY rows. */
  cost_basis: number | null
  notes: string | null
  executed_at: string
  created_at: string
}

export interface TransactionInput {
  symbol: string
  type: 'BUY' | 'SELL' | 'DIVIDEND'
  quantity: number
  price_per_share: number
  fees?: number
  notes?: string
  executed_at?: string
}

export interface InvestmentEntry {
  id: string
  user_id: string
  type: 'ADD' | 'WITHDRAW'
  amount: number
  notes: string | null
  invested_at: string
  created_at: string
}

export interface InvestmentInput {
  type: 'ADD' | 'WITHDRAW'
  amount: number
  notes?: string
  invested_at?: string
}

export interface NewsItem {
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  imageUrl?: string
}

export interface Partner {
  id: string
  user_id: string
  name: string
  percentage: number
  color: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PartnerInput {
  name: string
  percentage: number
  color?: string
  notes?: string
}

export interface PortfolioSummaryData {
  totalInvested: number
  currentValue: number
  totalGainLoss: number
  totalGainLossPercent: number
  totalFees: number
  holdingsCount: number
  realizedGainLoss: number
  potentialGainLoss: number
  totalPNL: number
  investmentAvailable: number
  totalAddedFunds: number
  totalWithdrawnFunds: number
  totalTaxPaid: number
  totalDividends: number
}
