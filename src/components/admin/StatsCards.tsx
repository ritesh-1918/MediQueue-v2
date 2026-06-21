'use client'

import { useCallback, useEffect, useState } from 'react'
import { StatCard } from '@/components/ui/Card'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminStats {
  totalToday:     number
  completedToday: number
  avgWaitMinutes: number
  activeDoctors:  number
  totalDoctors:   number
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-mq-surface border border-mq-border rounded-xl p-4 animate-pulse">
      <div className="h-3 w-20 rounded bg-mq-surface-raised mb-2" />
      <div className="h-8 w-16 rounded bg-mq-surface-raised mb-1" />
      <div className="h-2.5 w-24 rounded bg-mq-surface-raised" />
    </div>
  )
}

// ── StatsCards ────────────────────────────────────────────────────────────────

export function StatsCards() {
  const [stats,       setStats]       = useState<AdminStats | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchStats = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/stats')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load stats')
        return
      }
      setStats(json as AdminStats)
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
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + 30-second auto-refresh
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats()
    const id = setInterval(fetchStats, 30_000)
    return () => clearInterval(id)
  }, [fetchStats])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl bg-mq-error/5 border border-mq-error/20 px-4 py-3">
        <p className="text-xs text-mq-error">{error ?? 'Stats unavailable'}</p>
      </div>
    )
  }

  const completionRate = stats.totalToday > 0
    ? Math.round((stats.completedToday / stats.totalToday) * 100)
    : 0

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Tokens Issued Today"
          value={stats.totalToday}
          sub="All patients booked"
          accent="teal"
        />
        <StatCard
          label="Completed Today"
          value={stats.completedToday}
          sub={`${completionRate}% completion rate`}
          accent="green"
        />
        <StatCard
          label="Avg Wait Time"
          value={stats.avgWaitMinutes > 0 ? `${stats.avgWaitMinutes}m` : '—'}
          sub={stats.avgWaitMinutes > 0 ? 'From completed visits' : 'No completed visits yet'}
          accent="amber"
        />
        <StatCard
          label="Active Doctors"
          value={`${stats.activeDoctors} / ${stats.totalDoctors}`}
          sub="Currently live"
          accent="purple"
        />
      </div>

      {/* Refresh timestamp */}
      {lastUpdated && (
        <p className="text-[10px] font-mono text-mq-text-3 text-right">
          Refreshes every 30s · Last updated {lastUpdated}
        </p>
      )}
    </div>
  )
}
