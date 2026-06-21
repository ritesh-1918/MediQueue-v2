import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { PostgrestError } from '@supabase/supabase-js'

// ── Request shape ─────────────────────────────────────────────────────────────

type DoctorAction = 'call_next' | 'done' | 'skip'

interface ActionBody {
  action:           DoctorAction
  doctor_id:        string
  current_entry_id: string | null   // null when no patient is currently serving
}

function validateBody(body: unknown): body is ActionBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  const validActions: DoctorAction[] = ['call_next', 'done', 'skip']
  return (
    typeof b.doctor_id === 'string' && b.doctor_id.trim().length > 0 &&
    validActions.includes(b.action as DoctorAction) &&
    (b.current_entry_id === null || typeof b.current_entry_id === 'string')
  )
}

// ── Join normalisation ────────────────────────────────────────────────────────
// Supabase returns inner joins as object | object[]; centralise the cast here.

function extractName(joined: unknown): string {
  if (!joined) return '—'
  const row = Array.isArray(joined) ? joined[0] : joined
  return (row as { name?: string })?.name ?? '—'
}

// ── Helper: promote next waiting → serving ────────────────────────────────────

type ServiceClient = ReturnType<typeof createServiceClient>

async function promoteNextWaiting(
  supabase: ServiceClient,
  doctorId: string,
  todayIso: string
): Promise<{ id: string; token_number: number; patient_name: string } | { dbError: PostgrestError } | null> {
  const { data: nextRows } = await supabase
    .from('queue_entries')
    .select('id, token_number, patients!inner(name)')
    .eq('doctor_id', doctorId)
    .eq('status', 'waiting')
    .gte('booked_at', todayIso)
    .order('booked_at', { ascending: true })
    .limit(1)

  if (!nextRows || nextRows.length === 0) return null

  const next = nextRows[0]

  const { error } = await supabase
    .from('queue_entries')
    .update({ status: 'serving' })
    .eq('id', next.id)

  if (error) {
    console.error('[doctor/actions] promote error:', error)
    return { dbError: error }
  }

  return {
    id:           next.id,
    token_number: next.token_number,
    patient_name: extractName(next.patients),
  }
}

// ── Helper: log to activity_log ───────────────────────────────────────────────

async function log(
  supabase: ServiceClient,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
) {
  await supabase.from('activity_log').insert({ message, type })
}

// ── POST /api/doctor/actions ──────────────────────────────────────────────────
//
// call_next  — closes current serving/called entry (→ 'done'), promotes next waiting
// done       — marks current_entry_id as 'done', promotes next waiting, increments served_count
// skip       — re-queues current entry at end of today (booked_at → now), promotes next waiting,
//              increments skipped_count

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['doctor', 'admin'])
  if (isAuthError(auth)) return auth

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      { error: 'action, doctor_id, and current_entry_id are required' },
      { status: 400 }
    )
  }

  const { action, doctor_id, current_entry_id } = body
  const supabase   = createServiceClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso   = todayStart.toISOString()

  // Verify doctor exists
  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id, name, served_count, skipped_count')
    .eq('id', doctor_id)
    .single()

  if (doctorError || !doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  // ── call_next ────────────────────────────────────────────────────────────

  if (action === 'call_next') {
    if (current_entry_id) {
      const { error } = await supabase
        .from('queue_entries')
        .update({ status: 'done' })
        .eq('id', current_entry_id)
        .in('status', ['serving', 'called'])

      if (error) {
        console.error('[doctor/actions] call_next close error:', error)
        return NextResponse.json({ error: 'Failed to close current entry' }, { status: 500 })
      }

      await supabase
        .from('doctors')
        .update({ served_count: doctor.served_count + 1 })
        .eq('id', doctor_id)
    }

    const result = await promoteNextWaiting(supabase, doctor_id, todayIso)

    if (result && 'dbError' in result) {
      return NextResponse.json({ error: 'Failed to promote next patient' }, { status: 500 })
    }

    if (result) {
      await log(
        supabase,
        `T-${String(result.token_number).padStart(3, '0')} called — ${result.patient_name} → ${doctor.name}`,
        'info'
      )
    }

    return NextResponse.json({ ok: true, action: 'call_next', promoted: result })
  }

  // ── done ─────────────────────────────────────────────────────────────────

  if (action === 'done') {
    if (!current_entry_id) {
      return NextResponse.json({ error: 'current_entry_id is required for done' }, { status: 400 })
    }

    const { data: entry } = await supabase
      .from('queue_entries')
      .select('token_number, patients!inner(name)')
      .eq('id', current_entry_id)
      .single()

    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'done' })
      .eq('id', current_entry_id)
      .in('status', ['serving', 'called'])

    if (error) {
      console.error('[doctor/actions] done error:', error)
      return NextResponse.json({ error: 'Failed to mark entry as done' }, { status: 500 })
    }

    await supabase
      .from('doctors')
      .update({ served_count: doctor.served_count + 1 })
      .eq('id', doctor_id)

    if (entry) {
      await log(
        supabase,
        `T-${String(entry.token_number).padStart(3, '0')} done — ${extractName(entry.patients)} → ${doctor.name}`,
        'success'
      )
    }

    const result = await promoteNextWaiting(supabase, doctor_id, todayIso)

    if (result && 'dbError' in result) {
      return NextResponse.json({ error: 'Failed to promote next patient' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: 'done', promoted: result })
  }

  // ── skip ─────────────────────────────────────────────────────────────────

  if (action === 'skip') {
    if (!current_entry_id) {
      return NextResponse.json({ error: 'current_entry_id is required for skip' }, { status: 400 })
    }

    const { data: entry } = await supabase
      .from('queue_entries')
      .select('token_number, patients!inner(name)')
      .eq('id', current_entry_id)
      .single()

    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'waiting', booked_at: new Date().toISOString() })
      .eq('id', current_entry_id)
      .in('status', ['serving', 'called'])

    if (error) {
      console.error('[doctor/actions] skip error:', error)
      return NextResponse.json({ error: 'Failed to skip entry' }, { status: 500 })
    }

    await supabase
      .from('doctors')
      .update({ skipped_count: doctor.skipped_count + 1 })
      .eq('id', doctor_id)

    if (entry) {
      await log(
        supabase,
        `T-${String(entry.token_number).padStart(3, '0')} skipped — ${extractName(entry.patients)} re-queued`,
        'warning'
      )
    }

    const result = await promoteNextWaiting(supabase, doctor_id, todayIso)

    if (result && 'dbError' in result) {
      return NextResponse.json({ error: 'Failed to promote next patient' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: 'skip', promoted: result })
  }

  // Should never reach here — discriminated union is exhaustive
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
