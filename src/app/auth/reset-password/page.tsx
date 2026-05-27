'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { TrendingUp, Lock, CheckCircle, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Supabase fires PASSWORD_RECOVERY event after confirm route establishes the session.
  // We also check if there's already a session (user arrived via the redirect).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true)
      }
    })

    // If no session after 3 seconds, show an error
    const timeout = setTimeout(() => {
      setSessionError(prev => {
        if (!sessionReady) return true
        return prev
      })
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setDone(true)
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 2500)
  }

  if (done) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <Card className="max-w-md w-full text-center space-y-4 p-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100">Password updated</h2>
          <p className="text-sm text-zinc-400">
            Your password has been changed. Redirecting you to the dashboard…
          </p>
        </Card>
      </div>
    )
  }

  if (sessionError && !sessionReady) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <Card className="max-w-md w-full text-center space-y-4 p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100">Link expired or invalid</h2>
          <p className="text-sm text-zinc-400">
            This reset link is no longer valid. Please request a new one.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-block text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Request a new link
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center shadow-xl shadow-emerald-500/20 mx-auto">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 mt-4">Set new password</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Choose a strong password for your account
          </p>
        </div>

        <Card className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              required
            />

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              isLoading={loading}
              disabled={!sessionReady}
              className="w-full"
              size="lg"
            >
              {sessionReady ? 'Update Password' : 'Verifying link…'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
