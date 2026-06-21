import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/service'

// ── Clients (initialised lazily per request to avoid cold-start cost) ─────────

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey })
}

// ── Request / response shapes ─────────────────────────────────────────────────

interface SymptomCheckBody {
  symptoms: string
  age:      number
  duration: string
}

const MAX_SYMPTOMS_LENGTH = 1000   // chars — guard against prompt injection / cost abuse

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

// Shape the model MUST return inside the JSON object.
// Uses "advice" to match the app-level SymptomResult type in src/lib/types/index.ts.
interface ModelResponse {
  urgency:              'low' | 'medium' | 'high' | 'critical'
  possibleCondition:    string
  recommendedSpecialty: string
  advice:               string
  disclaimer:           string
}

const URGENCY_VALUES = ['low', 'medium', 'high', 'critical'] as const

function isValidModelResponse(obj: unknown): obj is ModelResponse {
  if (!obj || typeof obj !== 'object') return false
  const r = obj as Record<string, unknown>
  return (
    URGENCY_VALUES.includes(r.urgency as (typeof URGENCY_VALUES)[number]) &&
    typeof r.possibleCondition    === 'string' && r.possibleCondition.trim().length > 0 &&
    typeof r.recommendedSpecialty === 'string' && r.recommendedSpecialty.trim().length > 0 &&
    typeof r.advice               === 'string' && r.advice.trim().length > 0 &&
    typeof r.disclaimer           === 'string'
  )
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(specialties: string[]): string {
  const specialtyList = specialties.length > 0
    ? specialties.join(', ')
    : 'General, Cardiology, Dermatology, Neurology, Pulmonology'

  return `You are a medical triage assistant helping clinic staff prioritise patients.

Analyse the patient's reported symptoms and respond with ONLY a valid JSON object — no extra text, no markdown.

The JSON object must have exactly these fields:

{
  "urgency": "low" | "medium" | "high" | "critical",
  "possibleCondition": "<short name of the most likely condition, e.g. 'Viral fever'>",
  "recommendedSpecialty": "<one of the available specialties listed below>",
  "advice": "<2–3 plain-language sentences explaining the likely cause, what to watch for, and what the patient should do next>",
  "disclaimer": "This analysis is AI-generated for initial triage purposes only. It is not a diagnosis. Please consult a qualified doctor for medical advice."
}

Urgency guide:
- low      : routine, non-urgent, book appointment in a few days
- medium   : should be seen today
- high     : needs prompt attention within hours
- critical : potential emergency — advise immediate care

Available specialties at this clinic: ${specialtyList}

Always pick the closest matching specialty from the list above.
If nothing matches well, use "General".`
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

  // ── 2. Fetch live doctors from Supabase for context + matching ─────────────

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
  const specialties = [...new Set(liveDoctors.map((d) => d.specialty))]

  // ── 3. Call OpenAI ─────────────────────────────────────────────────────────

  let openai: OpenAI
  try {
    openai = getOpenAI()
  } catch {
    return NextResponse.json(
      { error: 'AI service is not configured. Contact the clinic administrator.' },
      { status: 503 }
    )
  }

  const userMessage = `Patient details:
- Age: ${age}
- Symptom duration: ${duration}
- Reported symptoms: ${symptoms.trim()}`

  let raw: string | null
  try {
    const completion = await openai.chat.completions.create({
      model:           'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature:     0.3,
      max_tokens:      500,
      messages: [
        { role: 'system', content: buildSystemPrompt(specialties) },
        { role: 'user',   content: userMessage },
      ],
    })

    raw = completion.choices[0]?.message?.content ?? null
  } catch (err) {
    console.error('[symptom-check] OpenAI error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown OpenAI error'
    if (msg.includes('401') || msg.includes('invalid_api_key')) {
      return NextResponse.json({ error: 'Invalid OpenAI API key' }, { status: 503 })
    }
    if (msg.includes('429') || msg.includes('quota')) {
      return NextResponse.json({ error: 'AI service is at capacity — please try again shortly' }, { status: 503 })
    }
    return NextResponse.json({ error: 'AI analysis failed — please try again' }, { status: 500 })
  }

  if (!raw) {
    return NextResponse.json({ error: 'AI returned an empty response' }, { status: 500 })
  }

  // ── 4. Parse and validate model output ────────────────────────────────────

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[symptom-check] JSON parse error, raw:', raw)
    return NextResponse.json({ error: 'AI returned malformed JSON' }, { status: 500 })
  }

  if (!isValidModelResponse(parsed)) {
    console.error('[symptom-check] unexpected model shape:', parsed)
    return NextResponse.json({ error: 'AI response was incomplete — please retry' }, { status: 500 })
  }

  // ── 5. Match doctors by recommended specialty ──────────────────────────────

  const matchingDoctors = liveDoctors.filter(
    (d) =>
      d.specialty.toLowerCase() === parsed.recommendedSpecialty.toLowerCase() ||
      d.specialty.toLowerCase().includes(parsed.recommendedSpecialty.toLowerCase()) ||
      parsed.recommendedSpecialty.toLowerCase().includes(d.specialty.toLowerCase())
  )

  const finalDoctors = matchingDoctors.length > 0
    ? matchingDoctors
    : liveDoctors.filter((d) => d.specialty.toLowerCase().includes('general'))

  // ── 6. Log analysis to activity_log ────────────────────────────────────────

  await supabase.from('activity_log').insert({
    message: `AI triage: age ${age}, ${duration} — ${parsed.possibleCondition} (${parsed.urgency})`,
    type:    parsed.urgency === 'critical' ? 'error'
           : parsed.urgency === 'high'     ? 'warning'
           : 'info',
  })

  // ── 7. Return structured response ──────────────────────────────────────────

  return NextResponse.json({
    urgency:              parsed.urgency,
    possibleCondition:    parsed.possibleCondition,
    recommendedSpecialty: parsed.recommendedSpecialty,
    advice:               parsed.advice,
    disclaimer:           parsed.disclaimer,
    matchingDoctors:      finalDoctors,
  })
}
