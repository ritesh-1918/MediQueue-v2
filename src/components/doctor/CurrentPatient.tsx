'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueueEntry {
  id:           string
  tokenNumber:  number
  tokenLabel:   string
  status:       string
  waitMinutes:  number | null
  bookedAt:     string
  patientId:    string | null
  patientName:  string
  patientPhone: string
}

interface CurrentPatientProps {
  doctorId:     string
  entry:        QueueEntry | null
  waitingCount: number
  onAction:     (action: 'call_next' | 'done' | 'skip', entryId: string | null) => Promise<void>
}

// ── Consultation timer ────────────────────────────────────────────────────────
// Self-contained: captures its own mount time via useEffect so Date.now() is
// never called during render (avoids react-hooks/purity). Parent remounts this
// via `key={entry.id}` whenever the patient changes, which resets the clock.

function ConsultationTimer() {
  const startRef   = useRef<number>(0)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    startRef.current = Date.now()
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const m  = Math.floor(seconds / 60)
  const s  = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  return (
    <span
      className={[
        'font-mono text-lg tabular-nums',
        seconds >= 600 ? 'text-mq-warning' : 'text-mq-text-1',
      ].join(' ')}
      title="Consultation duration"
    >
      {mm}:{ss}
    </span>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function NoPatient({
  waitingCount,
  onCallNext,
  loading,
}: {
  waitingCount: number
  onCallNext:   () => void
  loading:      boolean
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="text-4xl" aria-hidden="true">🩺</span>
      <p className="text-sm text-mq-text-2">No patient currently serving</p>
      {waitingCount > 0 ? (
        <>
          <p className="text-xs text-mq-text-3">
            {waitingCount} patient{waitingCount !== 1 ? 's' : ''} waiting
          </p>
          <Button
            variant="primary"
            size="md"
            loading={loading}
            loadingText="Calling…"
            onClick={onCallNext}
          >
            Call Next Patient
          </Button>
        </>
      ) : (
        <p className="text-xs text-mq-text-3">Queue is empty</p>
      )}
    </div>
  )
}

// ── CurrentPatient ────────────────────────────────────────────────────────────

export function CurrentPatient({
  entry,
  waitingCount,
  onAction,
}: CurrentPatientProps) {
  const [actionLoading, setActionLoading] = useState<'call_next' | 'done' | 'skip' | null>(null)
  const [error,         setError]         = useState<string | null>(null)

  async function handleAction(action: 'call_next' | 'done' | 'skip') {
    setActionLoading(action)
    setError(null)
    try {
      await onAction(action, entry?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const isBusy = actionLoading !== null

  if (!entry) {
    return (
      <div className="bg-mq-surface border border-mq-border rounded-xl p-4 sm:p-5">
        <p className="text-xs text-mq-text-2 mb-3 font-medium uppercase tracking-wide">
          Current Patient
        </p>
        <NoPatient
          waitingCount={waitingCount}
          onCallNext={() => handleAction('call_next')}
          loading={actionLoading === 'call_next'}
        />
        {error && (
          <p role="alert" className="text-xs text-mq-error text-center mt-2">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-mq-surface border border-mq-primary/40 rounded-xl p-4 sm:p-5 space-y-4
                    shadow-[0_0_0_1px_rgba(13,148,136,0.15)]">
      {/* Section label */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-mq-text-2 uppercase tracking-wide">
          Now Serving
        </p>
        <div className="flex items-center gap-1.5 text-xs text-mq-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-mq-primary animate-pulse" />
          In Consultation
        </div>
      </div>

      {/* Patient info */}
      <div className="flex items-center gap-4">
        {/* Token */}
        <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-mq-primary/10 border border-mq-primary/30
                        flex items-center justify-center">
          <span className="font-bold font-mono text-mq-primary text-sm">
            {entry.tokenLabel}
          </span>
        </div>

        {/* Name + phone */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-mq-text-1 truncate">
            {entry.patientName}
          </p>
          <p className="text-xs text-mq-text-3 mt-0.5">{entry.patientPhone}</p>
          <p className="text-[10px] text-mq-text-3 mt-1">
            Booked {new Date(entry.bookedAt).toLocaleTimeString('en-IN', {
              hour:   '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </p>
        </div>

        {/* Consultation timer — key resets the self-timed component on patient change */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <ConsultationTimer key={entry.id} />
          <span className="text-[10px] text-mq-text-3 mt-0.5">elapsed</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          loading={actionLoading === 'call_next'}
          loadingText="Calling…"
          disabled={isBusy}
          onClick={() => handleAction('call_next')}
          title="Mark done and call next patient"
        >
          Call Next
        </Button>

        <Button
          variant="warning"
          size="sm"
          loading={actionLoading === 'skip'}
          loadingText="Skipping…"
          disabled={isBusy}
          onClick={() => handleAction('skip')}
          title="Move this patient to end of queue"
        >
          Skip
        </Button>

        <Button
          variant="success"
          size="sm"
          loading={actionLoading === 'done'}
          loadingText="Saving…"
          disabled={isBusy}
          onClick={() => handleAction('done')}
          title="Mark consultation complete"
        >
          Done ✓
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-mq-error">{error}</p>
      )}
    </div>
  )
}
