import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }  from '@/lib/supabase/service'
import { predictWaitTime }       from '@/lib/ai/predict-wait'

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
    .select('id, name, is_live, specialty')
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

  const position = (positionCount ?? 0) + 1

  // ── 5. AI wait-time prediction ───────────────────────────────────────────

  const now = new Date()
  const prediction = await predictWaitTime({
    doctorId:         doctor_id,
    queuePosition:    position,
    timeOfDay:        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    dayOfWeek:        now.getDay(),
    currentlyServing: false,   // position already accounts for this via count query
    doctorSpecialty:  (doctor as { specialty?: string }).specialty,
  })

  // ── 6. Insert the queue entry (store AI-predicted wait) ──────────────────

  const { data: entry, error: entryError } = await supabase
    .from('queue_entries')
    .insert({
      patient_id:   patientId,
      doctor_id,
      token_number: tokenNumber,
      status:       'waiting',
      wait_minutes: prediction.minutes,
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

  // ── 7. Append to activity log ────────────────────────────────────────────

  await supabase.from('activity_log').insert({
    message: `T-${String(tokenNumber).padStart(3, '0')} booked — ${name.trim()} → ${doctor.name} (~${prediction.minutes}m wait, ${prediction.confidence} confidence)`,
    type:    'info',
  })

  // ── 8. WhatsApp notification — non-blocking ───────────────────────────────

  let whatsappSent = false
  if (phone.trim().length >= 10) {
    const { sendTokenWhatsApp } = await import('@/lib/notifications/whatsapp')
    const notif = await sendTokenWhatsApp({
      phone:         phone.trim(),
      patientName:   name.trim(),
      tokenNumber:   `T-${String(tokenNumber).padStart(3, '0')}`,
      doctorName:    doctor.name,
      estimatedWait: prediction.minutes,
      queuePosition: position,
    })
    whatsappSent = notif.success
    if (!notif.success) console.warn('[book] WhatsApp skipped:', notif.error)
  }

  // ── 9. Return confirmation ───────────────────────────────────────────────

  return NextResponse.json({
    tokenNumber,
    tokenLabel:   `T-${String(tokenNumber).padStart(3, '0')}`,
    queueEntryId: entry.id,
    position,
    estimatedWait: prediction.minutes,   // kept for backward compat
    prediction,
    doctorName:   doctor.name,
    whatsapp_sent: whatsappSent,
  })
}
