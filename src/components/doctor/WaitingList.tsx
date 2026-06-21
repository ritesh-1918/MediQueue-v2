'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { QueueEntry } from './CurrentPatient'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaitingListProps {
  doctorId:       string
  initialEntries: QueueEntry[]
  /** Called whenever the list changes so parent can update state */
  onUpdate: (entries: QueueEntry[]) => void
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-mq-surface-raised border border-mq-border animate-pulse">
      <div className="w-5 h-3 rounded bg-mq-border" />
      <div className="w-14 h-3 rounded bg-mq-border" />
      <div className="flex-1 h-3 rounded bg-mq-border" />
      <div className="w-16 h-3 rounded bg-mq-border hidden sm:block" />
      <div className="w-12 h-3 rounded bg-mq-border" />
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function WaitingRow({ entry, index }: { entry: QueueEntry; index: number }) {
  const waitLabel = entry.waitMinutes != null
    ? `~${entry.waitMinutes}m`
    : `~${(index + 1) * 8}m`

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-mq-surface-raised border border-mq-border">
      {/* Position */}
      <span className="text-xs font-mono text-mq-text-3 w-5 text-right shrink-0">
        {index + 1}
      </span>

      {/* Token */}
      <span className="font-mono text-sm font-semibold text-mq-text-1 tabular-nums w-14 shrink-0">
        {entry.tokenLabel}
      </span>

      {/* Name */}
      <span className="flex-1 text-sm text-mq-text-1 truncate">
        {entry.patientName}
      </span>

      {/* Booked at */}
      <span className="hidden sm:block text-[10px] font-mono text-mq-text-3 shrink-0">
        {new Date(entry.bookedAt).toLocaleTimeString('en-IN', {
          hour:   '2-digit',
          minute: '2-digit',
          hour12: true,
        })}
      </span>

      {/* Est. wait */}
      <span className="text-xs text-mq-text-2 shrink-0 w-10 text-right tabular-nums">
        {waitLabel}
      </span>
    </div>
  )
}

// ── WaitingList ───────────────────────────────────────────────────────────────

export function WaitingList({ doctorId, initialEntries, onUpdate }: WaitingListProps) {
  const [entries,     setEntries]     = useState<QueueEntry[]>(initialEntries)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const channelRef = useRef<RealtimeChannel | null>(null)

  // ── Re-fetch when Realtime fires ─────────────────────────────────────────

  async function refreshWaiting() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/doctor/queue?doctor_id=${doctorId}`)
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to refresh queue')
        return
      }

      const fresh: QueueEntry[] = json.waitingEntries ?? []
      setEntries(fresh)
      onUpdate(fresh)
      setError(null)
      setLastUpdated(
        new Date().toLocaleTimeString('en-IN', {
          hour:   '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      )
    } catch {
      setError('Network error — queue may be stale')
    } finally {
      setLoading(false)
    }
  }

  // ── Supabase Realtime subscription ───────────────────────────────────────
  // Subscribe to ALL queue_entries changes for this doctor.
  // Filter string: "doctor_id=eq.<uuid>" — Supabase Realtime v2 filter syntax.

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`doctor-queue-${doctorId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'queue_entries',
          filter: `doctor_id=eq.${doctorId}`,
        },
        () => {
          // Re-fetch full list on any change to avoid stale partial payloads
          refreshWaiting()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-mq-surface border border-mq-border rounded-xl p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-mq-text-1">Waiting</span>
          {entries.length > 0 && (
            <span className="text-[10px] font-mono bg-mq-primary/10 text-mq-primary border border-mq-primary/20 rounded-full px-2 py-0.5">
              {entries.length}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-mq-success bg-mq-success/10 border border-mq-success/20 rounded-full px-2 py-0.5">
            <span className="w-1 h-1 rounded-full bg-mq-success animate-pulse" />
            LIVE
          </span>
        </div>

        {lastUpdated && (
          <span className="text-[10px] font-mono text-mq-text-3 tabular-nums">
            {lastUpdated}
          </span>
        )}
      </div>

      {/* Refresh error */}
      {error && (
        <p className="text-xs text-mq-error bg-mq-error/5 border border-mq-error/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Column headers */}
      {entries.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-1 text-[10px] text-mq-text-3 uppercase tracking-wide">
          <span className="w-5 text-right shrink-0">#</span>
          <span className="w-14 shrink-0">Token</span>
          <span className="flex-1">Patient</span>
          <span className="hidden sm:block shrink-0">Booked</span>
          <span className="w-10 text-right shrink-0">Wait</span>
        </div>
      )}

      {/* Rows */}
      {loading && entries.length === 0 ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-2xl" aria-hidden="true">✓</span>
          <p className="text-sm text-mq-text-2">No patients waiting</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, i) => (
            <WaitingRow key={entry.id} entry={entry} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
