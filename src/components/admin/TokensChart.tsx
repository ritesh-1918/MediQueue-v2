'use client'

import { useEffect, useState } from 'react'
import { CardTitle } from '@/components/ui/Card'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DoctorBar {
  doctorId:   string
  doctorName: string
  specialty:  string
  isLive:     boolean
  total:      number
  completed:  number
  served:     number
  skipped:    number
}

// ── Single bar row ────────────────────────────────────────────────────────────

function BarRow({
  bar,
  maxValue,
}: {
  bar:      DoctorBar
  maxValue: number
}) {
  const totalPct     = maxValue > 0 ? (bar.total     / maxValue) * 100 : 0
  const completedPct = bar.total > 0 ? (bar.completed / bar.total)  * 100 : 0

  return (
    <div className="space-y-1">
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-mq-text-1 truncate">{bar.doctorName}</span>
          {bar.isLive && (
            <span className="w-1.5 h-1.5 rounded-full bg-mq-success animate-pulse shrink-0" aria-label="live" />
          )}
          <span className="text-[10px] text-mq-text-3 hidden sm:inline">{bar.specialty}</span>
        </div>
        <span className="text-xs font-mono text-mq-text-2 tabular-nums shrink-0">
          {bar.total}
        </span>
      </div>

      {/* Bar track */}
      <div className="h-5 rounded-md bg-mq-surface-raised border border-mq-border overflow-hidden">
        {/* Outer bar — total */}
        <div
          className="h-full rounded-md bg-mq-primary/20 relative transition-all duration-500"
          style={{ width: `${Math.max(totalPct, bar.total > 0 ? 2 : 0)}%` }}
        >
          {/* Inner bar — completed (overlaid) */}
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-mq-primary/70 transition-all duration-500"
            style={{ width: `${completedPct}%` }}
          />
        </div>
      </div>

      {/* Sub-stats */}
      <div className="flex items-center gap-3 text-[10px] text-mq-text-3">
        <span className="text-mq-success">{bar.completed} done</span>
        <span className="text-mq-warning">{bar.skipped} skipped</span>
        <span>{bar.total - bar.completed - bar.skipped} in progress</span>
      </div>
    </div>
  )
}

// ── TokensChart ───────────────────────────────────────────────────────────────

export function TokensChart() {
  const [bars,    setBars]    = useState<DoctorBar[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    async function fetchBars() {
      try {
        const res  = await fetch('/api/admin/stats')
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Failed to load chart'); return }
        setBars((json.tokensPerDoctor ?? []) as DoctorBar[])
        setError(null)
      } catch {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    }
    fetchBars()
    const id = setInterval(fetchBars, 30_000)
    return () => clearInterval(id)
  }, [])

  const maxValue = Math.max(...bars.map((b) => b.total), 1)

  // Sort descending by total tokens
  const sorted = [...bars].sort((a, b) => b.total - a.total)

  return (
    <div className="bg-mq-surface border border-mq-border rounded-xl p-4 sm:p-5">
      <CardTitle
        action={
          <div className="flex items-center gap-3 text-[10px] text-mq-text-3">
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 h-2 rounded bg-mq-primary/20 border border-mq-border" /> Total
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 h-2 rounded bg-mq-primary/70" /> Done
            </span>
          </div>
        }
      >
        Tokens Per Doctor — Today
      </CardTitle>

      {loading ? (
        <div className="space-y-4 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1 animate-pulse">
              <div className="flex justify-between">
                <div className="h-3 w-32 rounded bg-mq-surface-raised" />
                <div className="h-3 w-6 rounded bg-mq-surface-raised" />
              </div>
              <div className="h-5 rounded-md bg-mq-surface-raised" style={{ width: `${60 - i * 15}%` }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-mq-error py-2">{error}</p>
      ) : sorted.every((b) => b.total === 0) ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-mq-text-2">No tokens issued today yet</p>
          <p className="text-xs text-mq-text-3">Chart will populate as patients book in</p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {sorted.map((bar) => (
            <BarRow key={bar.doctorId} bar={bar} maxValue={maxValue} />
          ))}
        </div>
      )}
    </div>
  )
}
