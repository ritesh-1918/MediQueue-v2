'use client'

// Doctor dashboard is fully client-rendered — it's auth-gated, highly dynamic,
// and needs shared state between CurrentPatient and WaitingList for action
// coordination. SSR would provide no meaningful benefit here.
//
// useSearchParams() requires a <Suspense> boundary at the page level for
// Next.js static generation — DoctorDashboard is the Suspense child.

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SessionControls } from '@/components/doctor/SessionControls'
import { CurrentPatient, type QueueEntry } from '@/components/doctor/CurrentPatient'
import { WaitingList } from '@/components/doctor/WaitingList'

// ── Doctor state ──────────────────────────────────────────────────────────────

interface DoctorState {
  id:            string
  name:          string
  specialty:     string
  is_live:       boolean
  served_count:  number
  skipped_count: number
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex items-center gap-2 text-sm text-mq-text-2">
        <span className="w-4 h-4 border-2 border-mq-primary/30 border-t-mq-primary rounded-full animate-spin" />
        Loading dashboard…
      </div>
    </div>
  )
}

// ── Inner dashboard (uses useSearchParams — must be inside Suspense) ──────────

function DoctorDashboard() {
  const searchParams = useSearchParams()

  // TODO: replace with session-based doctor_id lookup once auth is wired up.
  const doctorId = searchParams.get('doctor_id') ?? ''

  const [doctor,         setDoctor]         = useState<DoctorState | null>(null)
  const [currentEntry,   setCurrentEntry]   = useState<QueueEntry | null>(null)
  const [waitingEntries, setWaitingEntries] = useState<QueueEntry[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)

  // ── Fetch queue state ────────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    if (!doctorId) return
    try {
      const res  = await fetch(`/api/doctor/queue?doctor_id=${doctorId}`)
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to load dashboard')
        return
      }

      setDoctor(json.doctor)
      setCurrentEntry(json.currentEntry)
      setWaitingEntries(json.waitingEntries)
      setError(null)
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }, [doctorId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQueue()
  }, [fetchQueue])

  // ── Handle doctor actions ────────────────────────────────────────────────

  const handleAction = useCallback(async (
    action: 'call_next' | 'done' | 'skip',
    entryId: string | null
  ) => {
    const res  = await fetch('/api/doctor/actions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action,
        doctor_id:        doctorId,
        current_entry_id: entryId,
      }),
    })
    const json = await res.json()

    if (!res.ok) {
      throw new Error(json.error ?? 'Action failed')
    }

    setCurrentEntry(null)
    await fetchQueue()
  }, [doctorId, fetchQueue])

  // ── Handle session toggle ────────────────────────────────────────────────

  function handleSessionToggle(nowLive: boolean) {
    setDoctor((prev) => prev ? { ...prev, is_live: nowLive } : prev)
  }

  // ── No doctor_id ────────────────────────────────────────────────────────

  if (!doctorId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-xs">
          <p className="text-sm font-medium text-mq-text-1">No doctor selected</p>
          <p className="text-xs text-mq-text-2">
            Append <code className="font-mono text-mq-primary">?doctor_id=&lt;uuid&gt;</code> to
            the URL, or sign in as a doctor once auth is wired up.
          </p>
        </div>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return <DashboardSkeleton />
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error || !doctor) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-sm font-medium text-mq-error">{error ?? 'Doctor not found'}</p>
          <button
            onClick={fetchQueue}
            className="text-xs text-mq-primary underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Dashboard ────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-mq-text-1 tracking-tight">
            Doctor Dashboard
          </h1>
          <p className="text-xs text-mq-text-2 mt-0.5">{doctor.specialty}</p>
        </div>
      </div>

      {/* Session controls — top strip */}
      <SessionControls
        doctorId={doctor.id}
        doctorName={doctor.name}
        isLive={doctor.is_live}
        stats={{
          servedCount:  doctor.served_count,
          skippedCount: doctor.skipped_count,
        }}
        onToggle={handleSessionToggle}
      />

      {/* Main grid: current patient (left) + waiting list (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-4 items-start">
        {/* Left — current patient + actions */}
        <CurrentPatient
          doctorId={doctor.id}
          entry={currentEntry}
          waitingCount={waitingEntries.length}
          onAction={handleAction}
        />

        {/* Right — live waiting list */}
        <WaitingList
          doctorId={doctor.id}
          initialEntries={waitingEntries}
          onUpdate={setWaitingEntries}
        />
      </div>
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────
// Suspense boundary required by Next.js static generation when a child
// component calls useSearchParams().

export default function DoctorPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DoctorDashboard />
    </Suspense>
  )
}
