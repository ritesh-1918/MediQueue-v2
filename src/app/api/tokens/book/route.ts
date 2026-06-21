import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// ── Request body shape ────────────────────────────────────────────────────────

interface BookTokenBody {
  name:      string
  phone:     string
  doctor_id: string
}

function validateBody(body: unknown): body is BookTokenBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.name      === 'string' && b.name.trim().length > 0  && b.name.trim().length <= 100 &&
    typeof b.phone     === 'string' && b.phone.trim().length > 0 && b.phone.trim().length <= 20  &&
    typeof b.doctor_id === 'string' && b.doctor_id.trim().length > 0
  )
}

// ── POST /api/tokens/book ─────────────────────────────────────────────────────
// Public: patients book tokens without an auth session.

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      { error: 'name (≤100 chars), phone (≤20 chars), and doctor_id are required' },
      { status: 400 }
    )
  }

  const { name, phone, doctor_id } = body

  const supabase = createServiceClient()

  // ── 1. Verify the doctor exists and is live ──────────────────────────────

  const { data: doctor, error: doctorError } = await supabase
    .from('doctors')
    .select('id, name, is_live')
    .eq('id', doctor_id)
    .single()

  if (doctorError || !doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
  }

  if (!doctor.is_live) {
    return NextResponse.json(
      { error: 'This doctor is not currently accepting patients' },
      { status: 409 }
    )
  }

  // ── 2. Upsert patient (look up by phone, create if first visit) ──────────

  const { data: existingPatient } = await supabase
    .from('patients')
    .select('id')
    .eq('phone', phone.trim())
    .maybeSingle()

  let patientId: string

  if (existingPatient) {
    patientId = existingPatient.id
    await supabase
      .from('patients')
      .update({ name: name.trim() })
      .eq('id', patientId)
  } else {
    const { data: newPatient, error: patientInsertError } = await supabase
      .from('patients')
      .insert({ name: name.trim(), phone: phone.trim() })
      .select('id')
      .single()

    if (patientInsertError || !newPatient) {
      console.error('[book] patient insert error:', patientInsertError)
      return NextResponse.json(
        { error: 'Failed to register patient' },
        { status: 500 }
      )
    }
    patientId = newPatient.id
  }

  // ── 3. Get next token number via SQL function ────────────────────────────

  const { data: tokenData, error: rpcError } = await supabase
    .rpc('next_token_number', { p_doctor_id: doctor_id })

  if (rpcError || tokenData === null) {
    console.error('[book] rpc error:', rpcError)
    return NextResponse.json(
      { error: 'Failed to generate token number' },
      { status: 500 }
    )
  }

  const tokenNumber = tokenData as number

  // ── 4. Count waiting/called/serving entries to compute position ──────────

  const { count: positionCount } = await supabase
    .from('queue_entries')
    .select('id', { count: 'exact', head: true })
    .eq('doctor_id', doctor_id)
    .in('status', ['waiting', 'called', 'serving'])

  const position      = (positionCount ?? 0) + 1
  const estimatedWait = position * 8

  // ── 5. Insert the queue entry ────────────────────────────────────────────

  const { data: entry, error: entryError } = await supabase
    .from('queue_entries')
    .insert({
      patient_id:   patientId,
      doctor_id,
      token_number: tokenNumber,
      status:       'waiting',
      wait_minutes: estimatedWait,
    })
    .select('id')
    .single()

  if (entryError || !entry) {
    console.error('[book] queue_entry insert error:', entryError)
    return NextResponse.json(
      { error: 'Failed to create queue entry' },
      { status: 500 }
    )
  }

  // ── 6. Append to activity log ────────────────────────────────────────────

  await supabase.from('activity_log').insert({
    message: `T-${String(tokenNumber).padStart(3, '0')} booked — ${name.trim()} → ${doctor.name}`,
    type:    'info',
  })

  // ── 7. Return confirmation ───────────────────────────────────────────────

  return NextResponse.json({
    tokenNumber,
    tokenLabel:    `T-${String(tokenNumber).padStart(3, '0')}`,
    queueEntryId:  entry.id,
    position,
    estimatedWait,
    doctorName:    doctor.name,
  })
}
