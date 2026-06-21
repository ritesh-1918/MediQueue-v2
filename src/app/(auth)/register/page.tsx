'use client'

import { useState }     from 'react'
import { useRouter }    from 'next/navigation'
import Link             from 'next/link'
import { createClient } from '@/lib/supabase/client'

const ROLES = [
  { value: 'patient', label: 'Patient'  },
  { value: 'doctor',  label: 'Doctor'   },
] as const

type Role = (typeof ROLES)[number]['value']

export default function RegisterPage() {
  const router = useRouter()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<Role>('patient')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email:    email.trim(),
        password,
        options:  {
          data: { name: name.trim(), role },
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      router.push('/patient')
      router.refresh()
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-mq-text-1 tracking-tight">
            Create your account
          </h1>
          <p className="mt-1 text-xs text-mq-text-2">
            Already have an account?{' '}
            <Link href="/login" className="text-mq-primary hover:underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="block text-xs text-mq-text-2 mb-1">
              Full name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Priya Mehta"
              className="w-full h-10 px-3 rounded-lg text-sm
                         bg-mq-surface border border-mq-border
                         text-mq-text-1 placeholder:text-mq-text-3
                         focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                         transition-colors"
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-xs text-mq-text-2 mb-1">
              Email address
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-10 px-3 rounded-lg text-sm
                         bg-mq-surface border border-mq-border
                         text-mq-text-1 placeholder:text-mq-text-3
                         focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                         transition-colors"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-xs text-mq-text-2 mb-1">
              Password
              <span className="text-mq-text-3 font-normal ml-1">(min 8 characters)</span>
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3 rounded-lg text-sm
                         bg-mq-surface border border-mq-border
                         text-mq-text-1 placeholder:text-mq-text-3
                         focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                         transition-colors"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-xs text-mq-text-2 mb-1">
              I am a…
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full h-10 px-3 rounded-lg text-sm
                         bg-mq-surface border border-mq-border
                         text-mq-text-1
                         focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                         transition-colors"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <p
              role="alert"
              className="text-xs text-mq-error bg-mq-error/5 border border-mq-error/20 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-mq-primary text-white text-sm font-semibold
                       hover:bg-mq-primary-hover disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {loading ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        {/* Back link */}
        <p className="mt-6 text-center text-xs text-mq-text-3">
          <Link href="/" className="hover:text-mq-text-2 transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
