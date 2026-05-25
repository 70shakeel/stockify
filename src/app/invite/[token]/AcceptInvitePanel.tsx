'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

interface Props {
  token: string
  invitedEmail: string
  percentage: number
}

export function AcceptInvitePanel({ token, invitedEmail, percentage }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  function handleAccept() {
    startTransition(async () => {
      setError(null)
      const supabase = createClient()
      const { data, error: rpcError } = await supabase
        .rpc('accept_partner_invitation', { invitation_token: token })

      if (rpcError) { setError(rpcError.message); return }
      if (!data?.success) { setError(data?.error ?? 'Failed to accept invitation'); return }

      setAccepted(true)
    })
  }

  if (accepted) {
    return (
      <Card className="w-full max-w-sm text-center space-y-4 py-8">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100">You&apos;re In!</h2>
          <p className="text-sm text-zinc-500 mt-1">
            You now have access to view this portfolio with a {Number(percentage).toFixed(1)}% profit share.
          </p>
        </div>
        <Button className="w-full" onClick={() => router.push('/profit-split')}>
          View Profit Split
        </Button>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm space-y-5">
      {/* Icon */}
      <div className="flex justify-center pt-2">
        <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
          <Users className="w-7 h-7 text-emerald-400" />
        </div>
      </div>

      {/* Invitation details */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-zinc-100">Portfolio Invitation</h2>
        <p className="text-sm text-zinc-500 mt-1">You&apos;ve been invited to view a portfolio</p>
      </div>

      <div className="bg-zinc-800/50 rounded-xl px-4 py-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Your email</span>
          <span className="text-zinc-200">{invitedEmail}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Profit share</span>
          <span className="text-emerald-400 font-semibold">{Number(percentage).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Access</span>
          <span className="text-zinc-400">Read-only</span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}

      <Button className="w-full" isLoading={isPending} onClick={handleAccept}>
        Accept Invitation
      </Button>

      <p className="text-xs text-zinc-600 text-center">
        By accepting you agree to view this portfolio in read-only mode.
        The portfolio owner can revoke your access at any time.
      </p>
    </Card>
  )
}
