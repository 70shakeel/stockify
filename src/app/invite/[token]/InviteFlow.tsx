'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, Mail, Lock, User, CheckCircle2,
  AlertTriangle, Users, Clock,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type InviteData = {
  invited_email: string
  percentage: number
  status: string
  expires_at: string
  portfolio_name: string
}

type Step = 'loading' | 'error' | 'expired' | 'already_accepted' | 'auth' | 'accept' | 'done'
type AuthMode = 'login' | 'signup'

export function InviteFlow({ token }: { token: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('loading')
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [wrongAccount, setWrongAccount] = useState(false)
  const [loggedInEmail, setLoggedInEmail] = useState('')

  // Auth form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)

  // Accept state
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // 1. Load invitation via SECURITY DEFINER function (works unauthenticated)
  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data, error } = await supabase
        .rpc('get_invitation_by_token', { p_token: token })

      if (error || !data || data.length === 0) {
        setStep('error')
        return
      }

      const inv = data[0] as InviteData
      setInvite(inv)

      if (inv.status === 'accepted') { setStep('already_accepted'); return }
      if (new Date(inv.expires_at) < new Date()) { setStep('expired'); return }

      // Check current session
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        if (user.email?.toLowerCase() !== inv.invited_email.toLowerCase()) {
          setWrongAccount(true)
          setLoggedInEmail(user.email ?? '')
          setStep('auth')
          return
        }
        setStep('accept')
        return
      }

      // Pre-fill email from invite
      setEmail(inv.invited_email)
      setStep('auth')
    }
    load()
  }, [token])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setWrongAccount(false)
    setLoggedInEmail('')
    setEmail(invite?.invited_email ?? '')
    setAuthError(null)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setAuthError(error.message); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email?.toLowerCase() !== invite?.invited_email.toLowerCase()) {
      await supabase.auth.signOut()
      setAuthError(`This invitation is for ${invite?.invited_email}. Please sign in with that email.`)
      return
    }
    setStep('accept')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    if (password.length < 6) { setAuthError('Password must be at least 6 characters'); return }
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/invite/${token}`,
      },
    })
    if (error) { setAuthError(error.message); return }

    // identities.length === 0 means the email is already registered
    if (data.user?.identities?.length === 0) {
      setAuthMode('login')
      setAuthError('This email already has an account. Please sign in instead.')
      return
    }

    setSignupSuccess(true)
  }

  function handleAccept() {
    startTransition(async () => {
      setAcceptError(null)
      const supabase = createClient()
      const { data, error } = await supabase
        .rpc('accept_partner_invitation', { invitation_token: token })

      if (error) { setAcceptError(error.message); return }
      if (!data?.success) { setAcceptError(data?.error ?? 'Failed to accept'); return }
      setStep('done')
    })
  }

  // ── Render states ─────────────────────────────────────────

  if (step === 'loading') {
    return (
      <Card className="w-full max-w-sm flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Loading invitation…</p>
      </Card>
    )
  }

  if (step === 'error') {
    return (
      <Card className="w-full max-w-sm text-center space-y-3 py-10">
        <p className="text-3xl">🔗</p>
        <h1 className="text-xl font-bold text-zinc-100">Invalid Link</h1>
        <p className="text-sm text-zinc-500">This invitation link is invalid or has already been used.</p>
      </Card>
    )
  }

  if (step === 'expired') {
    return (
      <Card className="w-full max-w-sm text-center space-y-3 py-10">
        <div className="flex justify-center">
          <Clock className="w-10 h-10 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-zinc-100">Invitation Expired</h1>
        <p className="text-sm text-zinc-500">
          This link expired on{' '}
          {invite ? new Date(invite.expires_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}.
          Ask your partner to send a new invitation.
        </p>
      </Card>
    )
  }

  if (step === 'already_accepted') {
    return (
      <Card className="w-full max-w-sm text-center space-y-3 py-10">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <h1 className="text-xl font-bold text-zinc-100">Already Accepted</h1>
        <p className="text-sm text-zinc-500">You have already accepted this invitation.</p>
        <Button className="w-full" onClick={() => router.push('/')}>Go to Dashboard</Button>
      </Card>
    )
  }

  if (step === 'auth') {
    // Wrong account — ask to sign out first
    if (wrongAccount) {
      return (
        <Card className="w-full max-w-sm space-y-5">
          <InviteBadge invite={invite!} />
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-300">
            <p className="font-medium mb-1">Wrong account</p>
            <p className="text-amber-400/80">
              You&apos;re signed in as <strong>{loggedInEmail}</strong>.
              This invite is for <strong>{invite?.invited_email}</strong>.
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            Sign out and continue
          </Button>
        </Card>
      )
    }

    if (signupSuccess) {
      return (
        <Card className="w-full max-w-sm text-center space-y-4 py-8">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100">Check your email</h2>
          <p className="text-sm text-zinc-400">
            We sent a confirmation link to <span className="text-zinc-200">{email}</span>.
            Click it to verify your account, then return to this link to accept the invitation.
          </p>
        </Card>
      )
    }

    return (
      <div className="w-full max-w-sm space-y-5">
        <InviteBadge invite={invite!} />

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-zinc-800/60 p-1 gap-1">
          <button
            onClick={() => { setAuthMode('login'); setAuthError(null) }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
              authMode === 'login'
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Sign In
          </button>
          <button
            onClick={() => { setAuthMode('signup'); setAuthError(null) }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
              authMode === 'signup'
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Create Account
          </button>
        </div>

        <Card className="space-y-4">
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
              />
              {authError && <AuthError message={authError} />}
              <Button type="submit" className="w-full" size="lg">
                Sign In &amp; Accept
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                placeholder="Ahmad Khan"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                icon={<User className="w-4 h-4" />}
                required
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
              />
              {authError && <AuthError message={authError} />}
              <Button type="submit" className="w-full" size="lg">
                Create Account
              </Button>
            </form>
          )}
        </Card>
      </div>
    )
  }

  if (step === 'accept') {
    return (
      <div className="w-full max-w-sm space-y-4">
        <InviteBadge invite={invite!} />

        <Card className="space-y-4">
          <div className="flex justify-center pt-2">
            <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
              <Users className="w-7 h-7 text-emerald-400" />
            </div>
          </div>

          <div className="bg-zinc-800/50 rounded-xl px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Portfolio</span>
              <span className="text-zinc-200 font-medium">{invite?.portfolio_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Your email</span>
              <span className="text-zinc-200">{invite?.invited_email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Profit share</span>
              <span className="text-emerald-400 font-semibold">{Number(invite?.percentage).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Access</span>
              <span className="text-zinc-400">Read-only</span>
            </div>
          </div>

          {acceptError && <AuthError message={acceptError} />}

          <Button className="w-full" isLoading={isPending} onClick={handleAccept}>
            Accept Invitation
          </Button>

          <p className="text-xs text-zinc-600 text-center">
            The portfolio owner can revoke your access at any time.
          </p>
        </Card>
      </div>
    )
  }

  // done
  return (
    <Card className="w-full max-w-sm text-center space-y-4 py-8">
      <div className="flex justify-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-zinc-100">You&apos;re In!</h2>
      <p className="text-sm text-zinc-500">
        You now have read-only access to <strong className="text-zinc-300">{invite?.portfolio_name}</strong> with a{' '}
        <strong className="text-emerald-400">{Number(invite?.percentage).toFixed(1)}%</strong> profit share.
      </p>
      <Button className="w-full" onClick={() => router.push('/')}>
        Go to Dashboard
      </Button>
    </Card>
  )
}

function InviteBadge({ invite }: { invite: InviteData }) {
  return (
    <div className="text-center space-y-2">
      <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center shadow-xl shadow-emerald-500/20 mx-auto">
        <TrendingUp className="w-7 h-7 text-white" />
      </div>
      <h1 className="text-xl font-bold text-zinc-100">You&apos;re invited</h1>
      <p className="text-sm text-zinc-500">
        to view <strong className="text-zinc-300">{invite.portfolio_name}</strong> on Stockify
        with a <strong className="text-emerald-400">{Number(invite.percentage).toFixed(1)}%</strong> profit share
      </p>
    </div>
  )
}

function AuthError({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-400 flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      {message}
    </p>
  )
}
