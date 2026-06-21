import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { analyzeSymptoms }           from '@/lib/ai/fallback-chain'

// ── Request shape ─────────────────────────────────────────────────────────────

interface SymptomCheckBody {
  symptoms: string
  age:      number
  duration: string
}

const MAX_SYMPTOMS_LENGTH = 1000   // guard against prompt injection / cost abuse

function validateBody(body: unknown): body is SymptomCheckBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.symptoms === 'string'  &&
    b.symptoms.trim().length >= 3   &&
    b.symptoms.trim().length <= MAX_SYMPTOMS_LENGTH &&
    typeof b.age      === 'number'  && b.age > 0 && b.age < 130 &&
    typeof b.duration === 'string'  && b.duration.trim().length > 0
  )
}

// ── POST /api/ai/symptom-check ────────────────────────────────────────────────
// Public: intentionally unauthenticated — symptom checker is available to all
// patients before they have a session. No PII is stored beyond the activity log.

export async function POST(request: NextRequest) {
  // ── 1. Parse and validate input ────────────────────────────────────────────

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      {
        error: `symptoms (3–${MAX_SYMPTOMS_LENGTH} chars), age (number 1–129), and duration (string) are required`,
      },
      { status: 400 }
    )
  }

  const { symptoms, age, duration } = body

  // ── 2. Fetch live doctors from Supabase for doctor-matching ───────────────

  const supabase = createServiceClient()

  const { data: doctors, error: doctorError } = await supabase
    .from('doctors')
    .select('id, name, specialty, is_live')
    .eq('is_live', true)
    .order('name', { ascending: true })

  if (doctorError) {
    console.error('[symptom-check] doctor fetch error:', doctorError)
    return NextResponse.json({ error: 'Failed to load doctor list' }, { status: 500 })
  }

  const liveDoctors = doctors ?? []

  // ── 3. Run AI analysis through fallback chain ──────────────────────────────

  const analysis = await analyzeSymptoms(symptoms, age, duration)

  console.log(`[symptom-check] provider used: ${analysis.provider}`)

  // ── 4. Match doctors by recommended specialty ──────────────────────────────

  const matchingDoctors = liveDoctors.filter(
    (d) =>
      d.specialty.toLowerCase() === analysis.recommendedSpecialty.toLowerCase() ||
      d.specialty.toLowerCase().includes(analysis.recommendedSpecialty.toLowerCase()) ||
      analysis.recommendedSpecialty.toLowerCase().includes(d.specialty.toLowerCase())
  )

  const finalDoctors = matchingDoctors.length > 0
    ? matchingDoctors
    : liveDoctors.filter((d) => d.specialty.toLowerCase().includes('general'))

  // ── 5. Log analysis to activity_log ────────────────────────────────────────

  await supabase.from('activity_log').insert({
    message: `AI triage (${analysis.provider}): age ${age}, ${duration} — ${analysis.possibleCondition} (${analysis.urgency})`,
    type:    analysis.urgency === 'critical' ? 'error'
           : analysis.urgency === 'high'     ? 'warning'
           : 'info',
  })

  // ── 6. Return structured response ──────────────────────────────────────────

  return NextResponse.json({
    urgency:              analysis.urgency,
    possibleCondition:    analysis.possibleCondition,
    recommendedSpecialty: analysis.recommendedSpecialty,
    advice:               analysis.advice,
    disclaimer:           analysis.disclaimer,
    matchingDoctors:      finalDoctors,
  })
}
