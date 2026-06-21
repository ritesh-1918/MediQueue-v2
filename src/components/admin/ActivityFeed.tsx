'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityLogRow } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Badge config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  info: {
    dot:   'bg-mq-primary',
    badge: 'bg-mq-primary/10 border-mq-primary/20 text-mq-primary',
    label: 'INFO',
  },
  success: {
    dot:   'bg-mq-success',
    badge: 'bg-mq-success/10 border-mq-success/20 text-mq-success',
    label: 'DONE',
  },
  warning: {
    dot:   'bg-mq-warning',
    badge: 'bg-mq-warning/10 border-mq-warning/20 text-mq-warning',
    label: 'SKIP',
  },
  error: {
    dot:   'bg-mq-error',
    badge: 'bg-mq-error/10 border-mq-error/20 text-mq-error',
    label: 'CRIT',
  },
} as const

type LogType = keyof typeof TYPE_CONFIG

function resolveType(type: string): LogType {
  return (TYPE_CONFIG[type as LogType] ? type : 'info') as LogType
}

// ── Single feed entry ─────────────────────────────────────────────────────────

function FeedEntry({ entry }: { entry: ActivityLogRow }) {
  const cfg  = TYPE_CONFIG[resolveType(entry.type)]
  const time = new Date(entry.created_at).toLocaleTimeString('en-IN', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-mq-border-subtle last:border-0">
      {/* Dot */}
      <span
        className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`}
        aria-hidden="true"
      />

      {/* Message */}
      <p className="flex-1 text-xs text-mq-text-1 leading-relaxed">{entry.message}</p>

      {/* Right side: type badge + time */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span
          className={`text-[9px] font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded border ${cfg.badge}`}
        >
          {cfg.label}
        </span>
        <span className="text-[9px] font-mono text-mq-text-3 tabular-nums">{time}</span>
      </div>
    </div>
  )
}

// ── ActivityFeed ──────────────────────────────────────────────────────────────

const MAX_ENTRIES = 50   // cap in-memory feed so it never grows unbounded

export function ActivityFeed() {
  const [entries,     setEntries]     = useState<ActivityLogRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const feedRef    = useRef<HTMLDivElement | null>(null)

  // ── Initial fetch (newest MAX_ENTRIES entries) ────────────────────────────

  async function fetchInitial() {
    try {
      const supabase = createClient()
      const { data, error: dbErr } = await supabase
        .from('activity_log')
        .select('id, message, type, created_at')
        .order('created_at', { ascending: false })
        .limit(MAX_ENTRIES)

      if (dbErr) { setError('Failed to load activity feed'); return }
      setEntries((data ?? []) as ActivityLogRow[])
      setError(null)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInitial()

    const supabase = createClient()

    const channel = supabase
      .channel('admin-activity-log')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'activity_log',
        },
        (payload) => {
          const newEntry = payload.new as ActivityLogRow
          setEntries((prev) => [newEntry, ...prev].slice(0, MAX_ENTRIES))

          // Auto-scroll to top when new entries arrive
          feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-mq-surface border border-mq-border rounded-xl p-4 sm:p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-mq-text-1">Activity Feed</span>
          <span className="flex items-center gap-1 text-[10px] text-mq-success bg-mq-success/10 border border-mq-success/20 rounded-full px-2 py-0.5">
            <span className="w-1 h-1 rounded-full bg-mq-success animate-pulse" />
            LIVE
          </span>
        </div>
        {entries.length > 0 && (
          <span className="text-[10px] font-mono text-mq-text-3">
            {entries.length} entries
          </span>
        )}
      </div>

      {/* Feed scroll area */}
      <div
        ref={feedRef}
        className="overflow-y-auto max-h-96 min-h-[160px]"
        role="log"
        aria-live="polite"
        aria-label="Activity feed"
      >
        {loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-mq-surface-raised shrink-0" />
                <div className="flex-1 h-3 rounded bg-mq-surface-raised" />
                <div className="w-8 h-3 rounded bg-mq-surface-raised shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-xs text-mq-error py-2">{error}</p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-mq-text-2">No activity yet</p>
            <p className="text-xs text-mq-text-3">Events appear here in real time</p>
          </div>
        ) : (
          entries.map((entry) => (
            <FeedEntry key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  )
}
