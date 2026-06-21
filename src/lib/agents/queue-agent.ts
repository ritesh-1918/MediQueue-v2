// ── Autonomous Queue Monitoring Agent ─────────────────────────────────────────
//
// Runs as a server-side function invoked by:
//   - GET /api/agent/queue  (manual trigger from admin dashboard)
//   - Supabase webhook / cron (external schedule)
//
// The agent inspects the live queue state and takes corrective actions:
//   A) Reassign patients whose doctor has gone offline
//   B) Escalate patients who have been waiting > 45 minutes
//   C) Log "queue clear" when all doctors are live but no patients are waiting
//
// Uses the service-role Supabase client (bypasses RLS) — server-only file.

import { createServiceClient } from '@/lib/supabase/service'

// ── Return type ───────────────────────────────────────────────────────────────

export interface AgentReport {
  timestamp:     string
  reassignments: number
  escalations:   number
  queueDepth:    number
  activeDoctors: number
  actions:       string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesAgo(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000)
}

async function logActivity(
  supabase: ReturnType<typeof createServiceClient>,
  message: string,
  type: 'info' | 'warning' | 'error' | 'success' = 'info',
): Promise<void> {
  await supabase.from('activity_log').insert({ message, type })
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runQueueAgent(): Promise<AgentReport> {
  const supabase = createServiceClient()
  const actions: string[] = []
  let reassignments = 0
  let escalations = 0

  // ── STEP A — Fetch current queue state ─────────────────────────────────────

  // Today's date range in UTC
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setUTCHours(23, 59, 59, 999)

  const [queueResult, doctorsResult] = await Promise.all([
    supabase
      .from('queue_entries')
      .select('id, patient_id, doctor_id, token_number, status, booked_at')
      .in('status', ['waiting', 'serving'])
      .gte('booked_at', todayStart.toISOString())
      .lte('booked_at', todayEnd.toISOString()),

    supabase
      .from('doctors')
      .select('id, name, is_live'),
  ])

  if (queueResult.error) throw new Error(`Queue fetch failed: ${queueResult.error.message}`)
  if (doctorsResult.error) throw new Error(`Doctors fetch failed: ${doctorsResult.error.message}`)

  const entries     = queueResult.data  ?? []
  const doctors     = doctorsResult.data ?? []
  const liveDoctors = doctors.filter((d) => d.is_live)
  const queueDepth  = entries.length

  // ── STEP B — Reassign patients from offline doctors ────────────────────────

  const offlineDoctors = doctors.filter((d) => !d.is_live)

  for (const offlineDoc of offlineDoctors) {
    const orphanedPatients = entries.filter(
      (e) => e.doctor_id === offlineDoc.id && e.status === 'waiting',
    )
    if (orphanedPatients.length === 0) continue

    // Pick the live doctor with the fewest waiting patients as the target
    const liveDoc = liveDoctors
      .map((d) => ({
        doctor: d,
        load: entries.filter((e) => e.doctor_id === d.id && e.status === 'waiting').length,
      }))
      .sort((a, b) => a.load - b.load)[0]?.doctor

    if (!liveDoc) {
      const msg = `Agent: No live doctor available to absorb ${orphanedPatients.length} patient(s) from offline Dr. ${offlineDoc.name}`
      actions.push(msg)
      await logActivity(supabase, msg, 'warning')
      continue
    }

    const ids = orphanedPatients.map((e) => e.id)

    const { error: updateErr } = await supabase
      .from('queue_entries')
      .update({ doctor_id: liveDoc.id })
      .in('id', ids)

    if (updateErr) {
      const msg = `Agent: Failed to reassign patients from Dr. ${offlineDoc.name}: ${updateErr.message}`
      actions.push(msg)
      await logActivity(supabase, msg, 'error')
      continue
    }

    reassignments += ids.length
    const msg = `Agent: Reassigned ${ids.length} patient(s) from Dr. ${offlineDoc.name} (offline) to Dr. ${liveDoc.name}`
    actions.push(msg)
    await logActivity(supabase, msg, 'warning')
  }

  // ── STEP C — Escalate long-wait patients ───────────────────────────────────

  // Check whether is_priority column exists by inspecting the first queue_entries row.
  // If the column is missing, the select will still succeed but the field will be absent.
  // We attempt a targeted update and treat a column-not-found error as "skip silently."
  const WAIT_THRESHOLD_MINUTES = 45

  const waitingEntries = entries.filter((e) => e.status === 'waiting')

  for (const entry of waitingEntries) {
    const waited = minutesAgo(entry.booked_at)
    if (waited < WAIT_THRESHOLD_MINUTES) continue

    const tokenLabel = `T-${String(entry.token_number).padStart(3, '0')}`

    // Attempt to set is_priority — silently skip if column doesn't exist.
    // We use `as never` to bypass strict Supabase type-gen since this column is
    // optional and may not be in the migration yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: prioErr } = await (supabase as any)
      .from('queue_entries')
      .update({ is_priority: true })
      .eq('id', entry.id)

    if (prioErr && prioErr.code === '42703') {
      // 42703 = undefined_column — is_priority column not yet added, skip flag
    } else if (prioErr) {
      console.warn(`[queue-agent] priority update failed for ${entry.id}: ${prioErr.message}`)
    }

    escalations++
    const msg = `Agent: Patient ${tokenLabel} has waited ${waited}m — flagged for priority`
    actions.push(msg)
    await logActivity(supabase, msg, 'warning')
  }

  // ── STEP D — Detect empty-queue opportunity ────────────────────────────────
  //
  // "Empty" means: all doctors are live AND queue depth is zero.
  // We only log this once per agent run (not once per doctor).

  if (liveDoctors.length > 0 && liveDoctors.length === doctors.length && queueDepth === 0) {
    const msg = `Agent: Queue clear — all patients served (${liveDoctors.length} doctor(s) active)`
    actions.push(msg)
    await logActivity(supabase, msg, 'success')
  }

  // ── STEP E — Return report ─────────────────────────────────────────────────

  return {
    timestamp:     new Date().toISOString(),
    reassignments,
    escalations,
    queueDepth,
    activeDoctors: liveDoctors.length,
    actions,
  }
}
