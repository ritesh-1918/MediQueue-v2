import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
// All figures are scoped to the current calendar day (UTC midnight boundary).
//
// Returns:
//   totalToday        — all tokens issued today (any status)
//   completedToday    — tokens with status 'done'
//   avgWaitMinutes    — mean of wait_minutes for done entries; 0 if none
//   activeDoctors     — doctors where is_live = true
//   tokensPerDoctor   — [ { doctorId, doctorName, specialty, total, completed } ]

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (isAuthError(auth)) return auth

  const supabase   = createServiceClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso   = todayStart.toISOString()

  // Run all independent queries in parallel
  const [
    allEntries,
    doneEntries,
    doctorsResult,
  ] = await Promise.all([
    // All queue entries today (any status) with doctor info
    supabase
      .from('queue_entries')
      .select('id, status, wait_minutes, doctor_id, doctors!inner(id, name, specialty)')
      .gte('booked_at', todayIso),

    // Done entries today for avg wait
    supabase
      .from('queue_entries')
      .select('wait_minutes')
      .gte('booked_at', todayIso)
      .eq('status', 'done'),

    // All doctors
    supabase
      .from('doctors')
      .select('id, name, specialty, is_live, served_count, skipped_count')
      .order('name', { ascending: true }),
  ])

  if (allEntries.error) {
    console.error('[admin/stats] allEntries error:', allEntries.error)
    return NextResponse.json({ error: 'Failed to fetch queue data' }, { status: 500 })
  }
  if (doctorsResult.error) {
    console.error('[admin/stats] doctors error:', doctorsResult.error)
    return NextResponse.json({ error: 'Failed to fetch doctor data' }, { status: 500 })
  }

  const entries   = allEntries.data   ?? []
  const done      = doneEntries.data  ?? []
  const doctors   = doctorsResult.data ?? []

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totalToday     = entries.length
  const completedToday = entries.filter((e) => e.status === 'done').length

  // ── Average wait (real data from completed entries) ────────────────────────

  const doneWithWait = done.filter((e) => e.wait_minutes != null && e.wait_minutes > 0)
  const avgWaitMinutes = doneWithWait.length > 0
    ? Math.round(
        doneWithWait.reduce((sum, e) => sum + (e.wait_minutes ?? 0), 0) /
        doneWithWait.length
      )
    : 0

  // ── Active doctors ─────────────────────────────────────────────────────────

  const activeDoctors = doctors.filter((d) => d.is_live).length

  // ── Tokens per doctor breakdown ────────────────────────────────────────────
  // Build a map from doctor_id → { total, completed } then merge with doctor rows

  const countMap = new Map<string, { total: number; completed: number }>()

  for (const entry of entries) {
    const did = entry.doctor_id
    const current = countMap.get(did) ?? { total: 0, completed: 0 }
    current.total += 1
    if (entry.status === 'done') current.completed += 1
    countMap.set(did, current)
  }

  const tokensPerDoctor = doctors.map((doc) => {
    const counts = countMap.get(doc.id) ?? { total: 0, completed: 0 }
    return {
      doctorId:   doc.id,
      doctorName: doc.name,
      specialty:  doc.specialty,
      isLive:     doc.is_live,
      total:      counts.total,
      completed:  counts.completed,
      served:     doc.served_count,
      skipped:    doc.skipped_count,
    }
  })

  return NextResponse.json({
    totalToday,
    completedToday,
    avgWaitMinutes,
    activeDoctors,
    totalDoctors: doctors.length,
    tokensPerDoctor,
  })
}
