'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { TrendingUp, Mail, Lock, KeyRound } from 'lucide-react'

import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="w-full max-w-md space-y-8">
      {/* Logo */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center shadow-xl shadow-emerald-500/20 mx-auto">
          <TrendingUp className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 mt-4">Welcome back</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Sign in to manage your PSX portfolio
        </p>
      </div>

      {/* Form */}
      <Card className="space-y-5">
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
            required
          />

          <div className="space-y-1">
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              required
            />
            <div className="flex justify-end">
              <Link
                href="/auth/forgot-password"
                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                <KeyRound className="w-3 h-3" /> Forgot password?
              </Link>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button
            type="submit"
            isLoading={loading}
            className="w-full"
            size="lg"
          >
            Sign In
          </Button>
        </form>
      </Card>

      {/* Footer */}
      <p className="text-center text-sm text-zinc-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/signup"
          className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          Create one
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
