'use client'

import { useState, useTransition } from 'react'
import { Plus, Users, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, DollarSign, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { cn, formatCurrency, getChangeColor } from '@/lib/utils'
import { addPartner, updatePartner, deletePartner } from '@/actions/partners'
import { addProfitWithdrawal, deleteProfitWithdrawal } from '@/actions/profitWithdrawals'
import { PartnerProfitList } from '@/components/partners/PartnerProfitList'
import type { Partner, PartnerInput, PortfolioSummaryData, ProfitWithdrawal } from '@/lib/psx/types'

const PARTNER_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#14b8a6', // teal
  '#a855f7', // purple
]

interface PartnerFormData {
  name: string
  percentage: string
  color: string
  notes: string
}

const emptyForm: PartnerFormData = {
  name: '',
  percentage: '',
  color: PARTNER_COLORS[0],
  notes: '',
}

interface ProfitSplitPanelProps {
  initialPartners: Partner[]
  summary: PortfolioSummaryData | null
  initialWithdrawals: ProfitWithdrawal[]
}

export function ProfitSplitPanel({ initialPartners, summary, initialWithdrawals }: ProfitSplitPanelProps) {
  const [partners, setPartners] = useState<Partner[]>(initialPartners)
  const [withdrawals, setWithdrawals] = useState<ProfitWithdrawal[]>(initialWithdrawals)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState<PartnerFormData>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Withdrawal modal state
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false)
  const [withdrawalPartnerId, setWithdrawalPartnerId] = useState<string | null>(null)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalDate, setWithdrawalDate] = useState(new Date().toISOString().split('T')[0])
  const [withdrawalNotes, setWithdrawalNotes] = useState('')
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null)
  const [isDeletingWithdrawal, setIsDeletingWithdrawal] = useState<string | null>(null)

  const totalPercent = partners.reduce((sum, p) => sum + Number(p.percentage), 0)
  const remaining = 100 - totalPercent
  const isBalanced = Math.abs(remaining) < 0.001

  const profit = summary?.totalPNL ?? 0
  const realizedPnL = summary?.realizedGainLoss ?? 0
  const unrealizedPnL = summary?.potentialGainLoss ?? 0
  const totalDividends = summary?.totalDividends ?? 0

  function openAdd() {
    const nextColor = PARTNER_COLORS[partners.length % PARTNER_COLORS.length]
    setForm({ ...emptyForm, color: nextColor })
    setEditingPartner(null)
    setFormError(null)
    setIsModalOpen(true)
  }

  function openEdit(partner: Partner) {
    setForm({
      name: partner.name,
      percentage: String(partner.percentage),
      color: partner.color,
      notes: partner.notes ?? '',
    })
    setEditingPartner(partner)
    setFormError(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingPartner(null)
    setFormError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pct = parseFloat(form.percentage)
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (isNaN(pct) || pct <= 0 || pct > 100) { setFormError('Enter a percentage between 0.001 and 100'); return }

    const input: PartnerInput = {
      name: form.name.trim(),
      percentage: pct,
      color: form.color,
      notes: form.notes || undefined,
    }

    startTransition(async () => {
      if (editingPartner) {
        const { data, error } = await updatePartner(editingPartner.id, input)
        if (error) { setFormError(error); return }
        if (data) setPartners(prev => prev.map(p => p.id === data.id ? data : p))
      } else {
        const { data, error } = await addPartner(input)
        if (error) { setFormError(error); return }
        if (data) setPartners(prev => [...prev, data])
      }
      closeModal()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const { error } = await deletePartner(id)
      if (!error) {
        setPartners(prev => prev.filter(p => p.id !== id))
        setDeleteConfirmId(null)
      }
    })
  }

  function openWithdrawalModal(partnerId: string) {
    setWithdrawalPartnerId(partnerId)
    setWithdrawalAmount('')
    setWithdrawalDate(new Date().toISOString().split('T')[0])
    setWithdrawalNotes('')
    setWithdrawalError(null)
    setIsWithdrawalModalOpen(true)
  }

  function closeWithdrawalModal() {
    setIsWithdrawalModalOpen(false)
    setWithdrawalPartnerId(null)
    setWithdrawalError(null)
  }

  function handleWithdrawalSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(withdrawalAmount)
    if (!withdrawalPartnerId) return
    if (isNaN(amt) || amt <= 0) { setWithdrawalError('Amount must be greater than 0'); return }

    startTransition(async () => {
      const { data, error } = await addProfitWithdrawal({
        partner_id: withdrawalPartnerId,
        amount: amt,
        notes: withdrawalNotes || undefined,
        withdrawn_at: new Date(withdrawalDate).toISOString(),
      })
      if (error) { setWithdrawalError(error); return }
      if (data) {
        const partner = partners.find(p => p.id === withdrawalPartnerId)
        setWithdrawals(prev => [
          { ...data, partner_name: partner?.name, partner_color: partner?.color },
          ...prev,
        ])
      }
      closeWithdrawalModal()
    })
  }

  function handleDeleteWithdrawal(id: string) {
    if (!confirm('Delete this profit withdrawal?')) return
    setIsDeletingWithdrawal(id)
    startTransition(async () => {
      const { error } = await deleteProfitWithdrawal(id)
      if (!error) setWithdrawals(prev => prev.filter(w => w.id !== id))
      setIsDeletingWithdrawal(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Profit Split</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Define partners and their share of portfolio profits
          </p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Partner
        </Button>
      </div>

      {/* Allocation status banner */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
        isBalanced
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      )}>
        {isBalanced
          ? <CheckCircle2 className="w-4 h-4 shrink-0" />
          : <AlertTriangle className="w-4 h-4 shrink-0" />
        }
        {isBalanced
          ? 'Allocations are balanced — total is exactly 100%.'
          : remaining > 0
            ? `${remaining.toFixed(3)}% unallocated. Add more partners or adjust percentages to reach 100%.`
            : `Over-allocated by ${Math.abs(remaining).toFixed(3)}%. Reduce partner percentages.`
        }
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Split visualizer */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">Allocation</h2>

            {partners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="w-10 h-10 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">No partners yet</p>
                <p className="text-xs text-zinc-600 mt-1">Add partners to see the split</p>
              </div>
            ) : (
              <>
                {/* Segmented bar */}
                <div className="h-3 rounded-full overflow-hidden flex gap-px mb-4 bg-zinc-800">
                  {partners.map(p => (
                    <div
                      key={p.id}
                      style={{
                        width: `${Math.min(Number(p.percentage), 100)}%`,
                        backgroundColor: p.color,
                      }}
                      className="transition-all duration-300"
                      title={`${p.name}: ${p.percentage}%`}
                    />
                  ))}
                  {!isBalanced && remaining > 0 && (
                    <div
                      style={{ width: `${remaining}%` }}
                      className="bg-zinc-700"
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  {partners.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-zinc-300 truncate">{p.name}</span>
                      </div>
                      <span className="text-zinc-400 shrink-0 ml-2 font-mono text-xs">
                        {Number(p.percentage).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                  {!isBalanced && remaining > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                        <span className="text-zinc-600 italic">Unallocated</span>
                      </div>
                      <span className="text-zinc-600 font-mono text-xs">{remaining.toFixed(1)}%</span>
                    </div>
                  )}
                </div>

                {/* Total pill */}
                <div className={cn(
                  'mt-4 flex items-center justify-between px-3 py-2 rounded-lg text-sm border',
                  isBalanced
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-zinc-800 border-zinc-700'
                )}>
                  <span className="text-zinc-400">Total</span>
                  <span className={cn(
                    'font-semibold font-mono',
                    isBalanced ? 'text-emerald-400' : totalPercent > 100 ? 'text-red-400' : 'text-amber-400'
                  )}>
                    {totalPercent.toFixed(1)}%
                  </span>
                </div>
              </>
            )}
          </Card>

          {/* Portfolio summary quick view */}
          {summary && (
            <Card>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Portfolio P&L</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total P&L</span>
                  <span className={cn('font-semibold', getChangeColor(profit))}>
                    {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Realized</span>
                  <span className={cn('font-medium', getChangeColor(realizedPnL))}>
                    {realizedPnL >= 0 ? '+' : ''}{formatCurrency(realizedPnL)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-amber-400" /> Dividends
                  </span>
                  <span className={cn('font-medium', totalDividends > 0 ? 'text-amber-400' : 'text-zinc-400')}>
                    {totalDividends > 0 ? '+' : ''}{formatCurrency(totalDividends)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Unrealized</span>
                  <span className={cn('font-medium', getChangeColor(unrealizedPnL))}>
                    {unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(unrealizedPnL)}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right: Partners table + profit breakdown */}
        <div className="lg:col-span-2 space-y-4">
          {partners.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-12 h-12 text-zinc-700 mb-4" />
              <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Partners Added</h3>
              <p className="text-sm text-zinc-500 max-w-sm">
                Add partners and assign profit percentages to see how your portfolio gains will be distributed.
              </p>
              <Button onClick={openAdd} className="mt-5">
                <Plus className="w-4 h-4" />
                Add Your First Partner
              </Button>
            </Card>
          ) : (
            <PartnerProfitList
              partners={partners}
              summary={summary!}
              withdrawals={withdrawals}
              deleteConfirmId={deleteConfirmId}
              isPending={isPending}
              onEdit={openEdit}
              onDeleteConfirm={setDeleteConfirmId}
              onDeleteCancel={() => setDeleteConfirmId(null)}
              onDeleteExecute={handleDelete}
              onWithdraw={openWithdrawalModal}
              onDeleteWithdrawal={handleDeleteWithdrawal}
            />
          )}
        </div>
      </div>

      {/* Withdraw Profit Modal */}
      <Modal
        isOpen={isWithdrawalModalOpen}
        onClose={closeWithdrawalModal}
        title="Withdraw Profit"
        size="sm"
      >
        <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
          {withdrawalPartnerId && (() => {
            const partner = partners.find(p => p.id === withdrawalPartnerId)
            const partnerShare = ((profit * Number(partner?.percentage ?? 0)) / 100)
            const alreadyWithdrawn = withdrawals
              .filter(w => w.partner_id === withdrawalPartnerId)
              .reduce((s, w) => s + Number(w.amount), 0)
            const available = partnerShare - alreadyWithdrawn
            return (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/60">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                  style={{ backgroundColor: partner?.color }}
                >
                  {partner?.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <p className="font-medium text-zinc-200">{partner?.name}</p>
                  <p className="text-zinc-500 text-xs">
                    Available: <span className={cn('font-medium', getChangeColor(available))}>{formatCurrency(available)}</span>
                    <span className="mx-1.5 text-zinc-700">·</span>
                    Total share: {formatCurrency(partnerShare)}
                  </p>
                </div>
              </div>
            )
          })()}

          <Input
            label="Amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Enter withdrawal amount"
            value={withdrawalAmount}
            onChange={e => setWithdrawalAmount(e.target.value)}
            required
          />

          <Input
            label="Date"
            type="date"
            value={withdrawalDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setWithdrawalDate(e.target.value)}
            required
          />

          <Input
            label="Notes (optional)"
            placeholder="e.g. Q1 profit distribution"
            value={withdrawalNotes}
            onChange={e => setWithdrawalNotes(e.target.value)}
          />

          {withdrawalError && (
            <p className="text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {withdrawalError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={closeWithdrawalModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isPending}>
              Record Withdrawal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingPartner ? 'Edit Partner' : 'Add Partner'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Partner Name"
            placeholder="e.g. Ahmed, Fatima, ABC Capital"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <Input
            label="Profit Share (%)"
            type="number"
            placeholder="e.g. 25"
            min="0.001"
            max="100"
            step="0.001"
            value={form.percentage}
            onChange={e => setForm(prev => ({ ...prev, percentage: e.target.value }))}
            required
          />

          {/* Color picker */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Color</label>
            <div className="flex flex-wrap gap-2">
              {PARTNER_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, color }))}
                  className={cn(
                    'w-7 h-7 rounded-lg transition-all cursor-pointer',
                    form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <Input
            label="Notes (optional)"
            placeholder="e.g. Silent partner, 2024 agreement"
            value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
          />

          {/* Live preview of remaining after this change */}
          {form.percentage && !isNaN(parseFloat(form.percentage)) && (
            <div className="text-xs text-zinc-500 bg-zinc-800/50 rounded-lg px-3 py-2">
              {(() => {
                const newPct = parseFloat(form.percentage)
                const currentTotal = partners
                  .filter(p => p.id !== editingPartner?.id)
                  .reduce((s, p) => s + Number(p.percentage), 0)
                const newTotal = currentTotal + newPct
                const diff = 100 - newTotal
                return diff === 0
                  ? '✓ Will reach exactly 100%'
                  : diff > 0
                    ? `${diff.toFixed(3)}% will remain unallocated after save`
                    : `Over-allocated by ${Math.abs(diff).toFixed(3)}% after save`
              })()}
            </div>
          )}

          {formError && (
            <p className="text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {formError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isPending}>
              {editingPartner ? 'Save Changes' : 'Add Partner'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
