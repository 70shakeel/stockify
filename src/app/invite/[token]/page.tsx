import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AcceptInvitePanel } from './AcceptInvitePanel'

interface Props {
  params: Promise<{ token: string }>
}

export const metadata = { title: 'Accept Invitation — Stockify' }

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  // Look up the invitation (no auth required to preview it)
  const { data: invitation } = await supabase
    .from('partner_invitations')
    .select('id, invited_email, percentage, status, expires_at, portfolio_id')
    .eq('token', token)
    .single()

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Invalid Link</h1>
          <p className="text-sm text-zinc-500">This invitation link is invalid or has already been used.</p>
        </div>
      </div>
    )
  }

  if (invitation.status !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">{invitation.status === 'accepted' ? '✅' : '❌'}</p>
          <h1 className="text-xl font-bold text-zinc-100 mb-2">
            {invitation.status === 'accepted' ? 'Already Accepted' : 'Invitation Declined'}
          </h1>
          <p className="text-sm text-zinc-500">This invitation has already been {invitation.status}.</p>
        </div>
      </div>
    )
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">⏰</p>
          <h1 className="text-xl font-bold text-zinc-100 mb-2">Invitation Expired</h1>
          <p className="text-sm text-zinc-500">This invitation link expired on {new Date(invitation.expires_at).toLocaleDateString()}. Ask your partner to send a new one.</p>
        </div>
      </div>
    )
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  // If logged in but with wrong email, show mismatch
  if (user && user.email?.toLowerCase() !== invitation.invited_email.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm space-y-3">
          <p className="text-4xl mb-4">⚠️</p>
          <h1 className="text-xl font-bold text-zinc-100">Wrong Account</h1>
          <p className="text-sm text-zinc-500">
            This invitation was sent to <strong className="text-zinc-300">{invitation.invited_email}</strong>
            {' '}but you&apos;re logged in as <strong className="text-zinc-300">{user.email}</strong>.
          </p>
          <p className="text-sm text-zinc-500">Sign out and log in with the correct email to accept.</p>
        </div>
      </div>
    )
  }

  if (!user) {
    redirect(`/auth/login?next=/invite/${token}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <AcceptInvitePanel
        token={token}
        invitedEmail={invitation.invited_email}
        percentage={invitation.percentage}
      />
    </div>
  )
}
