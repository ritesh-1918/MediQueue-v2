import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

// ── GET /api/doctor/queue?doctor_id=<uuid> ───────────────────────────────────
// Returns:
//   - currentEntry : the entry currently in 'serving' or 'called' state (or null)
//   - waitingEntries: all 'waiting' entries for today, ordered by booked_at asc
//   - doctor        : doctor row (name, specialty, served_count, skipped_count)
//
// Requires: doctor or admin role.
// TODO: derive doctor_id from auth session once auth is fully wired up — remove
//       the ?doctor_id query param and use auth.userId to look up the doctor row.

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['doctor', 'admin'])
  if (isAuthError(auth)) return auth

  const { searchParams } = request.nextUrl
  const doctorId = searchParams.get('doctor_id')

  if (!doctorId) {
    return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 })
  }

  const supabase   = createServiceClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso   = todayStart.toISOString()

  // ── Doctor record ──────────────────────────────────────────────────────────

  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id, name, specialty, is_live, served_count, skipped_count')
    .eq('id', doctorId)
    .single()

  if (doctorError || !doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  // ── Current entry (serving or called) ─────────────────────────────────────

  const { data: currentRows, error: currentError } = await supabase
    .from('queue_entries')
    .select(`
      id, token_number, status, wait_minutes, booked_at,
      patients!inner ( id, name, phone )
    `)
    .eq('doctor_id', doctorId)
    .in('status', ['serving', 'called'])
    .gte('booked_at', todayIso)
    .order('booked_at', { ascending: true })
    .limit(1)

  if (currentError) {
    console.error('[doctor/queue] current entry error:', currentError)
    return NextResponse.json({ error: 'Failed to fetch current entry' }, { status: 500 })
  }

  // ── Waiting entries ────────────────────────────────────────────────────────

  const { data: waitingRows, error: waitingError } = await supabase
    .from('queue_entries')
    .select(`
      id, token_number, status, wait_minutes, booked_at,
      patients!inner ( id, name, phone )
    `)
    .eq('doctor_id', doctorId)
    .eq('status', 'waiting')
    .gte('booked_at', todayIso)
    .order('booked_at', { ascending: true })

  if (waitingError) {
    console.error('[doctor/queue] waiting entries error:', waitingError)
    return NextResponse.json({ error: 'Failed to fetch waiting entries' }, { status: 500 })
  }

  // ── Shape helpers ──────────────────────────────────────────────────────────

  function shapeEntry(row: {
    id: string
    token_number: number
    status: string
    wait_minutes: number | null
    booked_at: string
    patients: { id: string; name: string; phone: string } | { id: string; name: string; phone: string }[] | null
  }) {
    const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients
    return {
      id:           row.id,
      tokenNumber:  row.token_number,
      tokenLabel:   `T-${String(row.token_number).padStart(3, '0')}`,
      status:       row.status,
      waitMinutes:  row.wait_minutes,
      bookedAt:     row.booked_at,
      patientId:    patient?.id   ?? null,
      patientName:  patient?.name ?? '—',
      patientPhone: patient?.phone ?? '—',
    }
  }

  const currentEntry = currentRows && currentRows.length > 0
    ? shapeEntry(currentRows[0] as Parameters<typeof shapeEntry>[0])
    : null

  const waitingEntries = (waitingRows ?? []).map(
    (r) => shapeEntry(r as Parameters<typeof shapeEntry>[0])
  )

  return NextResponse.json({ doctor, currentEntry, waitingEntries })
}
