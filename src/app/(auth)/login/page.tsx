'use client'

import { useState }      from 'react'
import { useRouter }     from 'next/navigation'
import Link              from 'next/link'
import { createClient }  from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email:    email.trim(),
        password,
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
            Sign in to MediQueue
          </h1>
          <p className="mt-1 text-xs text-mq-text-2">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-mq-primary hover:underline underline-offset-2">
              Create one
            </Link>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-xs text-mq-text-2 mb-1">
              Email address
            </label>
            <input
              id="email"
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
            <label htmlFor="password" className="block text-xs text-mq-text-2 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
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
            {loading ? 'Signing in…' : 'Sign In'}
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
