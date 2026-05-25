'use client'

import { useState, useTransition } from 'react'
import {
  Plus, Pencil, Trash2, Users, AlertTriangle, ChevronDown, ChevronUp,
  Mail, CheckCircle2, Clock, XCircle, UserMinus, Send, Briefcase,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  getPortfolioMembers,
  sendInvitation,
  revokeInvitation,
  removePartner,
} from '@/actions/portfolios'
import type { Portfolio, PortfolioInput, PortfolioMember } from '@/lib/psx/types'

const PORTFOLIO_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16',
]

interface PortfolioFormData {
  name: string
  description: string
  color: string
}

const emptyForm: PortfolioFormData = {
  name: '',
  description: '',
  color: PORTFOLIO_COLORS[0],
}

interface InviteFormData {
  email: string
  percentage: string
  color: string
  notes: string
}

const emptyInvite: InviteFormData = {
  email: '',
  percentage: '',
  color: PORTFOLIO_COLORS[0],
  notes: '',
}

interface Props {
  initialPortfolios: Portfolio[]
}

export function PortfoliosPanel({ initialPortfolios }: Props) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>(initialPortfolios)
  const [members, setMembers] = useState<Record<string, PortfolioMember[]>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingMembersFor, setLoadingMembersFor] = useState<string | null>(null)

  // Portfolio CRUD modal
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false)
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null)
  const [portfolioForm, setPortfolioForm] = useState<PortfolioFormData>(emptyForm)
  const [portfolioFormError, setPortfolioFormError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Invite modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [invitingForPortfolioId, setInvitingForPortfolioId] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState<InviteFormData>(emptyInvite)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  async function toggleExpand(portfolioId: string) {
    if (expandedId === portfolioId) {
      setExpandedId(null)
      return
    }
    setExpandedId(portfolioId)
    if (!members[portfolioId]) {
      setLoadingMembersFor(portfolioId)
      const { data } = await getPortfolioMembers(portfolioId)
      setMembers(prev => ({ ...prev, [portfolioId]: data }))
      setLoadingMembersFor(null)
    }
  }

  function openAdd() {
    const nextColor = PORTFOLIO_COLORS[portfolios.length % PORTFOLIO_COLORS.length]
    setPortfolioForm({ ...emptyForm, color: nextColor })
    setEditingPortfolio(null)
    setPortfolioFormError(null)
    setIsPortfolioModalOpen(true)
  }

  function openEdit(p: Portfolio) {
    setPortfolioForm({ name: p.name, description: p.description ?? '', color: p.color })
    setEditingPortfolio(p)
    setPortfolioFormError(null)
    setIsPortfolioModalOpen(true)
  }

  function closePortfolioModal() {
    setIsPortfolioModalOpen(false)
    setEditingPortfolio(null)
    setPortfolioFormError(null)
  }

  function handlePortfolioSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!portfolioForm.name.trim()) { setPortfolioFormError('Portfolio name is required'); return }

    const input: PortfolioInput = {
      name: portfolioForm.name.trim(),
      description: portfolioForm.description || undefined,
      color: portfolioForm.color,
    }

    startTransition(async () => {
      if (editingPortfolio) {
        const { data, error } = await updatePortfolio(editingPortfolio.id, input)
        if (error) { setPortfolioFormError(error); return }
        if (data) setPortfolios(prev => prev.map(p => p.id === data.id ? data : p))
      } else {
        const { data, error } = await createPortfolio(input)
        if (error) { setPortfolioFormError(error); return }
        if (data) setPortfolios(prev => [...prev, data])
      }
      closePortfolioModal()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const { error } = await deletePortfolio(id)
      if (!error) {
        setPortfolios(prev => prev.filter(p => p.id !== id))
        setDeleteConfirmId(null)
        if (expandedId === id) setExpandedId(null)
      }
    })
  }

  function openInvite(portfolioId: string) {
    const portfolio = portfolios.find(p => p.id === portfolioId)
    const nextColor = PORTFOLIO_COLORS[(members[portfolioId]?.filter(m => m.status === 'accepted').length ?? 0) % PORTFOLIO_COLORS.length]
    setInviteForm({ ...emptyInvite, color: portfolio?.color ?? nextColor })
    setInvitingForPortfolioId(portfolioId)
    setInviteError(null)
    setInviteSuccess(null)
    setIsInviteModalOpen(true)
  }

  function closeInviteModal() {
    setIsInviteModalOpen(false)
    setInvitingForPortfolioId(null)
    setInviteError(null)
    setInviteSuccess(null)
  }

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invitingForPortfolioId) return
    const pct = parseFloat(inviteForm.percentage)
    if (!inviteForm.email.trim()) { setInviteError('Email is required'); return }
    if (isNaN(pct) || pct <= 0 || pct > 100) { setInviteError('Percentage must be between 0 and 100'); return }

    startTransition(async () => {
      const { data, error } = await sendInvitation({
        portfolio_id: invitingForPortfolioId,
        invited_email: inviteForm.email.trim(),
        percentage: pct,
        color: inviteForm.color,
        notes: inviteForm.notes || undefined,
      })
      if (error) { setInviteError(error); return }
      if (data) {
        const newMember: PortfolioMember = {
          portfolio_id: invitingForPortfolioId,
          portfolio_name: portfolios.find(p => p.id === invitingForPortfolioId)?.name ?? '',
          partner_id: null,
          name: data.invited_email,
          email: data.invited_email,
          percentage: Number(data.percentage),
          color: data.color,
          notes: data.notes,
          partner_user_id: null,
          status: 'pending',
          created_at: data.created_at,
          expires_at: data.expires_at,
          invitation_token: data.token,
        }
        setMembers(prev => ({
          ...prev,
          [invitingForPortfolioId]: [...(prev[invitingForPortfolioId] ?? []), newMember],
        }))
        setInviteSuccess(`Invitation sent to ${data.invited_email}`)
      }
    })
  }

  function handleRevoke(portfolioId: string, invitationToken: string) {
    startTransition(async () => {
      // Find the invitation by token to get the id — we need to re-fetch or track id
      // For simplicity revoke by finding in members list
      const member = members[portfolioId]?.find(m => m.invitation_token === invitationToken)
      if (!member) return
      // The revokeInvitation action expects the invitation id, but we only stored the token.
      // We'll delete by token via a workaround: just re-fetch members after calling the action.
      // Actually we stored invitation_token = inv.token (UUID). Let's pass it as the id param
      // since the action uses .eq('id', invitationId) — we need the actual id.
      // Re-fetch to get the actual id. Easier: just remove from local state optimistically and call revoke.
      // The action needs the DB id. Since we didn't store it, reload members.
      const supabaseModule = await import('@/lib/supabase/client')
      const supabase = supabaseModule.createClient()
      const { data } = await supabase
        .from('partner_invitations')
        .select('id')
        .eq('token', invitationToken)
        .single()
      if (!data) return
      const { error } = await revokeInvitation(data.id)
      if (!error) {
        setMembers(prev => ({
          ...prev,
          [portfolioId]: (prev[portfolioId] ?? []).filter(m => m.invitation_token !== invitationToken),
        }))
      }
    })
  }

  function handleRemovePartner(portfolioId: string, partnerId: string) {
    if (!confirm('Remove this partner? They will lose access to this portfolio.')) return
    startTransition(async () => {
      const { error } = await removePartner(partnerId)
      if (!error) {
        setMembers(prev => ({
          ...prev,
          [portfolioId]: (prev[portfolioId] ?? []).filter(m => m.partner_id !== partnerId),
        }))
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Portfolios</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your portfolios and invite partners to view them
          </p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Portfolio
        </Button>
      </div>

      {/* Empty state */}
      {portfolios.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="w-12 h-12 text-zinc-700 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-300 mb-1">No Portfolios Yet</h3>
          <p className="text-sm text-zinc-500 max-w-sm">
            Create your first portfolio to start tracking investments and sharing with partners.
          </p>
          <Button onClick={openAdd} className="mt-5">
            <Plus className="w-4 h-4" />
            Create Portfolio
          </Button>
        </Card>
      )}

      {/* Portfolio list */}
      <div className="space-y-3">
        {portfolios.map(portfolio => {
          const isExpanded = expandedId === portfolio.id
          const portfolioMembers = members[portfolio.id] ?? []
          const acceptedCount = portfolioMembers.filter(m => m.status === 'accepted').length
          const pendingCount = portfolioMembers.filter(m => m.status === 'pending').length
          const isConfirmingDelete = deleteConfirmId === portfolio.id

          return (
            <Card key={portfolio.id} padding="none" className="overflow-hidden">
              {/* Portfolio header row */}
              <div className="px-5 py-4 flex items-center gap-4">
                {/* Color dot */}
                <div
                  className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: portfolio.color + '20', border: `1px solid ${portfolio.color}40` }}
                >
                  <Briefcase className="w-5 h-5" style={{ color: portfolio.color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-zinc-100">{portfolio.name}</p>
                    {acceptedCount > 0 && (
                      <Badge variant="default" className="text-xs">
                        {acceptedCount} {acceptedCount === 1 ? 'member' : 'members'}
                      </Badge>
                    )}
                    {pendingCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {pendingCount} pending
                      </span>
                    )}
                  </div>
                  {portfolio.description && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{portfolio.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400">Delete portfolio?</span>
                      <Button variant="danger" size="sm" isLoading={isPending} onClick={() => handleDelete(portfolio.id)}>Yes</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>No</Button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => openInvite(portfolio.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Invite partner"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(portfolio)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit portfolio"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(portfolio.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Delete portfolio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => toggleExpand(portfolio.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
                    title={isExpanded ? 'Collapse' : 'Manage members'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded members section */}
              {isExpanded && (
                <div className="border-t border-zinc-800">
                  {loadingMembersFor === portfolio.id ? (
                    <div className="px-5 py-6 text-center text-sm text-zinc-500">Loading members…</div>
                  ) : portfolioMembers.length === 0 ? (
                    <div className="px-5 py-6 flex flex-col items-center text-center gap-2">
                      <Users className="w-8 h-8 text-zinc-700" />
                      <p className="text-sm text-zinc-500">No partners yet</p>
                      <button
                        onClick={() => openInvite(portfolio.id)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Mail className="w-3.5 h-3.5" /> Send an invitation
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/60">
                      {/* Table header */}
                      <div className="px-5 py-2 grid grid-cols-12 gap-3 text-xs text-zinc-600 uppercase tracking-wide">
                        <div className="col-span-5">Member</div>
                        <div className="col-span-2 text-right">Share</div>
                        <div className="col-span-3">Status</div>
                        <div className="col-span-2" />
                      </div>

                      {portfolioMembers.map((member, idx) => (
                        <div key={idx} className="px-5 py-3 grid grid-cols-12 gap-3 items-center">
                          {/* Avatar + name */}
                          <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                              style={{ backgroundColor: member.color }}
                            >
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-zinc-200 truncate">
                                {member.status === 'accepted' ? member.name : member.email}
                              </p>
                              {member.status === 'accepted' && member.email && (
                                <p className="text-xs text-zinc-600 truncate">{member.email}</p>
                              )}
                            </div>
                          </div>

                          {/* Percentage */}
                          <div className="col-span-2 text-right">
                            <span className="text-sm font-mono text-zinc-300">{Number(member.percentage).toFixed(1)}%</span>
                          </div>

                          {/* Status badge */}
                          <div className="col-span-3">
                            {member.status === 'accepted' && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Accepted
                              </span>
                            )}
                            {member.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                            {member.status === 'declined' && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                <XCircle className="w-3 h-3" /> Declined
                              </span>
                            )}
                          </div>

                          {/* Remove / revoke */}
                          <div className="col-span-2 flex justify-end">
                            {member.status === 'accepted' && member.partner_id && (
                              <button
                                onClick={() => handleRemovePartner(portfolio.id, member.partner_id!)}
                                className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Remove partner"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(member.status === 'pending' || member.status === 'declined') && member.invitation_token && (
                              <button
                                onClick={() => handleRevoke(portfolio.id, member.invitation_token!)}
                                className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Revoke invitation"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Add more footer */}
                      <div className="px-5 py-3 flex items-center justify-between">
                        <span className="text-xs text-zinc-600">
                          {acceptedCount} accepted · {pendingCount} pending
                        </span>
                        <button
                          onClick={() => openInvite(portfolio.id)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Invite another
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Create / Edit Portfolio Modal */}
      <Modal
        isOpen={isPortfolioModalOpen}
        onClose={closePortfolioModal}
        title={editingPortfolio ? 'Edit Portfolio' : 'New Portfolio'}
        size="sm"
      >
        <form onSubmit={handlePortfolioSubmit} className="space-y-4">
          <Input
            label="Portfolio Name"
            placeholder="e.g. Main Portfolio, Growth Fund"
            value={portfolioForm.name}
            onChange={e => setPortfolioForm(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <Input
            label="Description (optional)"
            placeholder="e.g. Long-term blue chips"
            value={portfolioForm.description}
            onChange={e => setPortfolioForm(prev => ({ ...prev, description: e.target.value }))}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Color</label>
            <div className="flex flex-wrap gap-2">
              {PORTFOLIO_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setPortfolioForm(prev => ({ ...prev, color }))}
                  className={cn(
                    'w-7 h-7 rounded-lg transition-all cursor-pointer',
                    portfolioForm.color === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
                      : 'hover:scale-105'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {portfolioFormError && (
            <p className="text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {portfolioFormError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={closePortfolioModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isPending}>
              {editingPortfolio ? 'Save Changes' : 'Create Portfolio'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invite Partner Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={closeInviteModal}
        title="Invite Partner"
        size="sm"
      >
        {inviteSuccess ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-zinc-100">Invitation Recorded</p>
                <p className="text-sm text-zinc-500 mt-1">{inviteSuccess}</p>
                <p className="text-xs text-zinc-600 mt-2">
                  Share the accept link with them — they sign in with this email and accept via the invitation page.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeInviteModal}>Done</Button>
              <Button className="flex-1" onClick={() => {
                setInviteSuccess(null)
                setInviteForm(emptyInvite)
              }}>
                Invite Another
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="text-xs text-zinc-500 bg-zinc-800/50 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
              <span>
                Enter the partner&apos;s email. They will need to sign up/log in with this exact email to accept.
              </span>
            </div>

            <Input
              label="Partner Email"
              type="email"
              placeholder="partner@example.com"
              value={inviteForm.email}
              onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              required
            />

            <Input
              label="Profit Share (%)"
              type="number"
              placeholder="e.g. 25"
              min="0.001"
              max="100"
              step="0.001"
              value={inviteForm.percentage}
              onChange={e => setInviteForm(prev => ({ ...prev, percentage: e.target.value }))}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300">Color</label>
              <div className="flex flex-wrap gap-2">
                {PORTFOLIO_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setInviteForm(prev => ({ ...prev, color }))}
                    className={cn(
                      'w-7 h-7 rounded-lg transition-all cursor-pointer',
                      inviteForm.color === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
                        : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <Input
              label="Notes (optional)"
              placeholder="e.g. Silent partner, 2024 agreement"
              value={inviteForm.notes}
              onChange={e => setInviteForm(prev => ({ ...prev, notes: e.target.value }))}
            />

            {inviteError && (
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {inviteError}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={closeInviteModal}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" isLoading={isPending}>
                <Send className="w-4 h-4" />
                Send Invite
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
