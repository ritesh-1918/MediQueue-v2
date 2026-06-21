'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityLogRow } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Agent report type (mirrors AgentReport from queue-agent.ts) ───────────────

interface AgentReport {
  timestamp:     string
  reassignments: number
  escalations:   number
  queueDepth:    number
  activeDoctors: number
  actions:       string[]
  executionMs:   number
}

// ── Agent report card ─────────────────────────────────────────────────────────

function AgentReportCard({ report, onDismiss }: { report: AgentReport; onDismiss: () => void }) {
  return (
    <div className="mb-4 rounded-xl border border-mq-primary/30 bg-mq-primary/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-mq-primary">Agent Run Complete</span>
          <span className="text-[9px] font-mono text-mq-text-3 tabular-nums">{report.executionMs}ms</span>
        </div>
        <button onClick={onDismiss} className="text-mq-text-3 hover:text-mq-text-2 transition-colors text-sm leading-none" aria-label="Dismiss agent report">✕</button>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {([
          { label: 'Reassigned', value: report.reassignments, warn: report.reassignments > 0 },
          { label: 'Escalated',  value: report.escalations,  warn: report.escalations > 0  },
          { label: 'Queue',      value: report.queueDepth,   warn: false },
          { label: 'Active Drs', value: report.activeDoctors, warn: false },
        ] as const).map(({ label, value, warn }) => (
          <div key={label} className={`rounded-lg border px-3 py-2 text-center ${warn ? 'border-mq-warning/30 bg-mq-warning/5' : 'border-mq-border bg-mq-surface'}`}>
            <p className={`text-base font-bold tabular-nums ${warn ? 'text-mq-warning' : 'text-mq-text-1'}`}>{value}</p>
            <p className="text-[9px] text-mq-text-3 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      {report.actions.length > 0 ? (
        <ul className="space-y-1">
          {report.actions.map((action, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-mq-text-2">
              <span className="text-mq-primary mt-0.5 shrink-0">›</span>{action}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-mq-text-3">No actions taken — queue is healthy.</p>
      )}
    </div>
  )
}

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

const MAX_ENTRIES = 50

export function ActivityFeed() {
  const [entries,      setEntries]      = useState<ActivityLogRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentReport,  setAgentReport]  = useState<AgentReport | null>(null)
  const [agentError,   setAgentError]   = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const feedRef    = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInitial()

    const supabase = createClient()
    const channel = supabase
      .channel('admin-activity-log')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const newEntry = payload.new as ActivityLogRow
          setEntries((prev) => [newEntry, ...prev].slice(0, MAX_ENTRIES))
          feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleRunAgent() {
    setAgentRunning(true)
    setAgentReport(null)
    setAgentError(null)

    try {
      const res = await fetch('/api/agent/queue', {
        method:  'GET',
        headers: { 'x-agent-key': process.env.NEXT_PUBLIC_AGENT_SECRET_KEY ?? '' },
      })
      const json = await res.json() as AgentReport & { error?: string }

      if (!res.ok) {
        setAgentError(json.error ?? `Agent returned HTTP ${res.status}`)
        return
      }
      setAgentReport(json)
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setAgentRunning(false)
    }
  }

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
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <span className="text-[10px] font-mono text-mq-text-3">{entries.length} entries</span>
          )}
          <button
            onClick={handleRunAgent}
            disabled={agentRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                       bg-mq-primary text-white hover:bg-mq-primary-hover
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Run queue monitoring agent"
          >
            {agentRunning ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Running…
              </>
            ) : <>⚡ Run Agent</>}
          </button>
        </div>
      </div>

      {agentReport && <AgentReportCard report={agentReport} onDismiss={() => setAgentReport(null)} />}

      {agentError && (
        <div className="mb-3 rounded-lg border border-mq-error/30 bg-mq-error/5 px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-mq-error">{agentError}</p>
          <button onClick={() => setAgentError(null)} className="text-mq-error hover:opacity-70 text-sm ml-2" aria-label="Dismiss error">✕</button>
        </div>
      )}

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
          entries.map((entry) => <FeedEntry key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  )
}
