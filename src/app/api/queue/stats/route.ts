import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// ── GET /api/queue/stats ──────────────────────────────────────────────────────
// Returns clinic-wide queue stats for the current calendar day.
// Used by: landing page stats strip, patient portal header.

export async function GET() {
  const supabase = createServiceClient()

  // All of today's queue entries (any status)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()

  // ── Active entries (waiting / called / serving) ──────────────────────────

  const { data: activeEntries, error: activeError } = await supabase
    .from('queue_entries')
    .select('id, token_number, status, doctor_id, wait_minutes, booked_at')
    .gte('booked_at', todayIso)
    .in('status', ['waiting', 'called', 'serving'])
    .order('booked_at', { ascending: true })

  if (activeError) {
    console.error('[queue/stats] active entries error:', activeError)
    return NextResponse.json(
      { error: 'Failed to fetch queue stats' },
      { status: 500 }
    )
  }

  // ── Completed entries today (for avg wait) ───────────────────────────────

  const { data: doneEntries, error: doneError } = await supabase
    .from('queue_entries')
    .select('wait_minutes')
    .gte('booked_at', todayIso)
    .eq('status', 'done')

  if (doneError) {
    console.error('[queue/stats] done entries error:', doneError)
    return NextResponse.json(
      { error: 'Failed to fetch completed entries' },
      { status: 500 }
    )
  }

  // ── Currently serving token ──────────────────────────────────────────────

  const servingEntry = activeEntries?.find((e) => e.status === 'serving')
    ?? activeEntries?.find((e) => e.status === 'called')

  const nowServing = servingEntry
    ? `T-${String(servingEntry.token_number).padStart(3, '0')}`
    : null

  // ── Average wait time (real, from completed consultations) ──────────────
  // Falls back to estimate if no completed entries yet today.

  let avgWait: number
  const completedWithWait = (doneEntries ?? []).filter(
    (e) => e.wait_minutes !== null && e.wait_minutes > 0
  )

  if (completedWithWait.length > 0) {
    const total = completedWithWait.reduce(
      (sum, e) => sum + (e.wait_minutes ?? 0),
      0
    )
    avgWait = Math.round(total / completedWithWait.length)
  } else {
    // No completed entries yet — estimate from current queue depth
    const waitingCount = (activeEntries ?? []).filter(
      (e) => e.status === 'waiting'
    ).length
    avgWait = waitingCount > 0 ? waitingCount * 8 : 0
  }

  // ── Live doctor count ────────────────────────────────────────────────────

  const { count: liveDoctors } = await supabase
    .from('doctors')
    .select('id', { count: 'exact', head: true })
    .eq('is_live', true)

  // ── Total tokens issued today ────────────────────────────────────────────

  const { count: totalToday } = await supabase
    .from('queue_entries')
    .select('id', { count: 'exact', head: true })
    .gte('booked_at', todayIso)

  return NextResponse.json({
    inQueue:      (activeEntries ?? []).length,
    nowServing,
    avgWait,
    liveDoctors:  liveDoctors ?? 0,
    totalToday:   totalToday  ?? 0,
  })
}
