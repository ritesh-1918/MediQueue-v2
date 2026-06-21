'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/ui/Badge'
import type { QueueStatus } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueRow {
  id:           string
  token_number: number
  status:       QueueStatus
  patient_name: string
  doctor_name:  string
  booked_at:    string
}

// ── Token label helper ────────────────────────────────────────────────────────

function tokenLabel(n: number) {
  return `T-${String(n).padStart(3, '0')}`
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
      <span className="text-3xl" aria-hidden="true">🏥</span>
      <p className="text-sm text-mq-text-2">Queue is empty right now.</p>
      <p className="text-xs text-mq-text-3">Book a token above to get started.</p>
    </div>
  )
}

// ── Single queue row ──────────────────────────────────────────────────────────

function QueueEntry({ entry, index }: { entry: QueueRow; index: number }) {
  const isServing = entry.status === 'serving' || entry.status === 'called'

  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors',
        isServing
          ? 'bg-mq-primary/5 border-mq-primary/30'
          : 'bg-mq-surface-raised border-mq-border',
      ].join(' ')}
    >
      {/* Position number */}
      <span className="text-xs font-mono text-mq-text-3 w-5 text-right shrink-0">
        {index + 1}
      </span>

      {/* Token */}
      <span
        className={[
          'font-mono text-sm font-semibold tabular-nums w-14 shrink-0',
          isServing ? 'text-mq-primary' : 'text-mq-text-1',
        ].join(' ')}
      >
        {tokenLabel(entry.token_number)}
      </span>

      {/* Patient name */}
      <span className="flex-1 text-sm text-mq-text-1 truncate">
        {entry.patient_name}
      </span>

      {/* Doctor */}
      <span className="hidden sm:block text-xs text-mq-text-3 truncate max-w-[120px]">
        {entry.doctor_name}
      </span>

      {/* Status badge */}
      <StatusBadge status={entry.status} />
    </div>
  )
}

// ── Live Queue component ──────────────────────────────────────────────────────

export function LiveQueue() {
  const [entries,     setEntries]     = useState<QueueRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const channelRef = useRef<RealtimeChannel | null>(null)

  // ── Fetch current queue ──────────────────────────────────────────────────

  async function fetchQueue() {
    try {
      const supabase = createClient()
      const { data, error: dbError } = await supabase
        .from('queue_entries')
        .select(`
          id,
          token_number,
          status,
          booked_at,
          patients!inner ( name ),
          doctors!inner  ( name )
        `)
        .in('status', ['waiting', 'called', 'serving'])
        .order('token_number', { ascending: true })

      if (dbError) {
        setError('Failed to load queue')
        return
      }

      // Flatten the joined rows
      const rows: QueueRow[] = (data ?? []).map((r) => ({
        id:           r.id,
        token_number: r.token_number,
        status:       r.status as QueueStatus,
        // Supabase returns joined table as object or array; normalise both
        patient_name: Array.isArray(r.patients)
          ? (r.patients[0]?.name ?? '—')
          : ((r.patients as { name: string } | null)?.name ?? '—'),
        doctor_name: Array.isArray(r.doctors)
          ? (r.doctors[0]?.name ?? '—')
          : ((r.doctors as { name: string } | null)?.name ?? '—'),
        booked_at:    r.booked_at,
      }))

      setEntries(rows)
      setLastUpdated(
        new Date().toLocaleTimeString('en-IN', {
          hour:   '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      )
      setError(null)
    } catch {
      setError('Network error — retrying…')
    } finally {
      setLoading(false)
    }
  }

  // ── Realtime subscription ────────────────────────────────────────────────

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQueue()

    const supabase = createClient()

    const channel = supabase
      .channel('live-queue-public')
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'queue_entries',
        },
        () => {
          // Re-fetch on any change — simpler than merging partial payloads
          fetchQueue()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-mq-text-1">Live Queue</span>
          <span className="flex items-center gap-1 text-[10px] text-mq-success bg-mq-success/10 border border-mq-success/20 rounded-full px-2 py-0.5">
            <span className="w-1 h-1 rounded-full bg-mq-success animate-pulse" />
            LIVE
          </span>
        </div>

        {lastUpdated && (
          <span className="text-[10px] font-mono text-mq-text-3 tabular-nums">
            Updated {lastUpdated}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-mq-surface-raised border border-mq-border animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg bg-mq-error/10 border border-mq-error/20 px-4 py-3">
          <p className="text-xs text-mq-error">{error}</p>
        </div>
      ) : entries.length === 0 ? (
        <EmptyQueue />
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, i) => (
            <QueueEntry key={entry.id} entry={entry} index={i} />
          ))}
        </div>
      )}

      {/* Count footer */}
      {!loading && entries.length > 0 && (
        <p className="text-xs text-mq-text-3 text-right">
          {entries.length} patient{entries.length !== 1 ? 's' : ''} in queue
        </p>
      )}
    </div>
  )
}
