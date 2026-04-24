/**
 * FIFO (First-In, First-Out) lot tracking for portfolio cost basis.
 *
 * Sells consume the oldest purchased shares first.  The remaining lots
 * represent the unsold portion, and their weighted average is the true
 * open-position avg cost — which is what the user sees as "Avg Cost".
 */

export type Lot = { qty: number; price: number }

/**
 * Record a BUY into the lot queue.
 * If the position was fully closed (openQty ≤ 0) before this buy, the queue
 * is reset first so stale historical lots don't skew the new position's avg cost.
 */
export function addBuyLot(lots: Lot[], qty: number, price: number): void {
  const openQty = lots.reduce((s, l) => s + l.qty, 0)
  if (openQty <= 0) lots.length = 0
  lots.push({ qty, price })
}

/**
 * Consume shares from the front of the queue (FIFO) for a SELL.
 * Mutates `lots` in-place.
 * Returns the weighted-average cost per share of the consumed lots
 * (i.e. the cost basis for this sell transaction).
 */
export function consumeSellLots(lots: Lot[], sellQty: number): number {
  let remaining = sellQty
  let totalCost = 0
  let totalConsumed = 0

  while (remaining > 0 && lots.length > 0) {
    const lot = lots[0]
    const consumed = Math.min(lot.qty, remaining)
    totalCost += consumed * lot.price
    totalConsumed += consumed
    remaining -= consumed
    lot.qty -= consumed
    if (lot.qty <= 0) lots.shift()
  }

  return totalConsumed > 0 ? totalCost / totalConsumed : 0
}

/**
 * Weighted-average cost per share of all remaining (unsold) lots.
 */
export function lotsAvgCost(lots: Lot[]): number {
  const totalQty = lots.reduce((s, l) => s + l.qty, 0)
  if (totalQty === 0) return 0
  return lots.reduce((s, l) => s + l.qty * l.price, 0) / totalQty
}

/**
 * Total cost of all remaining (unsold) lots (price × qty, no fees).
 */
export function lotsTotalCost(lots: Lot[]): number {
  return lots.reduce((s, l) => s + l.qty * l.price, 0)
}
