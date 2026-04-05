'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { TrendingUp, Mail, Lock, User } from 'lucide-react'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <Card className="max-w-md w-full text-center space-y-4 p-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100">Check your email</h2>
          <p className="text-sm text-zinc-400">
            We&apos;ve sent a confirmation link to <span className="text-zinc-200">{email}</span>.
            Click the link to activate your account.
          </p>
          <Link
            href="/auth/login"
            className="inline-block text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Back to sign in
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center shadow-xl shadow-emerald-500/20 mx-auto">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 mt-4">Create your account</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Start managing your PSX portfolio today
          </p>
        </div>

        {/* Form */}
        <Card className="space-y-5">
          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="Ahmad Khan"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              icon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              className="w-full"
              size="lg"
            >
              Create Account
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
