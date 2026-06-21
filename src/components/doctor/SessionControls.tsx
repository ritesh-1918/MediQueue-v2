'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionStats {
  servedCount:  number
  skippedCount: number
}

interface SessionControlsProps {
  doctorId:   string
  doctorName: string
  isLive:     boolean
  stats:      SessionStats
  onToggle:   (nowLive: boolean) => void
}

// ── Session duration timer ────────────────────────────────────────────────────
// Self-contained: captures its own mount time via effect so no impure Date.now()
// call happens during render. Remounts naturally when isLive toggles (conditional render).

function SessionTimer() {
  const startRef   = useRef<number>(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    startRef.current = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const h  = Math.floor(elapsed / 3600)
  const m  = Math.floor((elapsed % 3600) / 60)
  const s  = elapsed % 60
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  return (
    <span className="font-mono tabular-nums text-mq-text-1">
      {h > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`}
    </span>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  accent,
}: {
  label:  string
  value:  number
  accent: string
}) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-lg border ${accent}`}>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-[10px] text-mq-text-2 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  )
}

// ── SessionControls ───────────────────────────────────────────────────────────

export function SessionControls({
  doctorId,
  doctorName,
  isLive,
  stats,
  onToggle,
}: SessionControlsProps) {
  const [toggling, setToggling] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleToggle() {
    setToggling(true)
    setError(null)

    try {
      const res  = await fetch('/api/doctors', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: doctorId, is_live: !isLive }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to update session status')
        return
      }

      onToggle(!isLive)
    } catch {
      setError('Network error')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="bg-mq-surface border border-mq-border rounded-xl p-4 sm:p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-mq-text-2 mb-0.5">Session</p>
          <p className="text-sm font-semibold text-mq-text-1">{doctorName}</p>
        </div>

        {/* Session status + toggle */}
        <div className="flex items-center gap-3">
          {isLive && (
            <div className="flex items-center gap-1.5 text-xs text-mq-success">
              <span className="w-1.5 h-1.5 rounded-full bg-mq-success animate-pulse" />
              Live
            </div>
          )}

          <Button
            variant={isLive ? 'danger' : 'success'}
            size="sm"
            loading={toggling}
            loadingText={isLive ? 'Ending…' : 'Starting…'}
            onClick={handleToggle}
          >
            {isLive ? 'End Session' : 'Start Session'}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3">
        <StatPill
          label="Served"
          value={stats.servedCount}
          accent="bg-mq-success/5 border-mq-success/20 text-mq-success"
        />
        <StatPill
          label="Skipped"
          value={stats.skippedCount}
          accent="bg-mq-warning/5 border-mq-warning/20 text-mq-warning"
        />

        {isLive && (
          <div className="flex flex-col items-center px-4 py-2 rounded-lg border border-mq-border bg-mq-surface-raised ml-auto">
            <SessionTimer />
            <span className="text-[10px] text-mq-text-2 uppercase tracking-wider mt-0.5">
              Duration
            </span>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-mq-error">
          {error}
        </p>
      )}
    </div>
  )
}
