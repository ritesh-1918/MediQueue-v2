// ── AI Wait-Time Predictor ─────────────────────────────────────────────────────
//
// Replaces the hardcoded "position × 8 minutes" formula with a data-driven
// prediction backed by:
//   1. Historical wait_minutes from completed queue entries for this doctor
//   2. Groq LLM inference (llama-3.1-8b-instant) when history is thin (< 5 rows)
//   3. Graceful fallback to position × 8 if both above fail
//
// Server-only — uses the service-role Supabase client. Never import client-side.

import { createServiceClient } from '@/lib/supabase/service'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WaitPrediction {
  minutes:    number
  confidence: 'low' | 'medium' | 'high'
  basis:      string
}

export interface PredictWaitParams {
  doctorId:         string
  queuePosition:    number
  timeOfDay:        string   // e.g. "14:30"
  dayOfWeek:        number   // 0 = Sunday … 6 = Saturday
  currentlyServing: boolean  // true if the doctor is mid-consultation
  doctorSpecialty?: string   // passed through for Groq context when history is thin
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ── Groq inference ─────────────────────────────────────────────────────────────

interface GroqWaitResult {
  minutes:   number
  reasoning: string
}

async function callGroqForEstimate(
  position:    number,
  avgMinutes:  number | null,   // null = no history
  timeOfDay:   string,
  dayOfWeek:   number,
  specialty:   string,
): Promise<GroqWaitResult | null> {
  const apiKey = process.env.GROQ_API_KEY_1
  if (!apiKey) return null

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const avgInfo  = avgMinutes != null
    ? `Average consultation time for this doctor is ${avgMinutes.toFixed(1)} minutes based on recent history.`
    : `No historical data available for this doctor (specialty: ${specialty}).`

  const prompt =
    `A clinic queue has ${position} patient(s) ahead of the new patient. ` +
    `${avgInfo} ` +
    `Current time: ${timeOfDay} on a ${dayNames[dayOfWeek]}. ` +
    `Is this a busy period? Estimate the total wait time in minutes for the new patient. ` +
    `Reply with ONLY a valid JSON object — no markdown, no explanation outside JSON: ` +
    `{"minutes": <number>, "reasoning": "<one sentence>"}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        temperature: 0.2,
        max_tokens:  120,
        messages:    [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      console.warn(`[predict-wait] Groq HTTP ${res.status}`)
      return null
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>
    }
    const raw = data.choices?.[0]?.message?.content ?? ''

    // Strip markdown fences if the model wraps output anyway
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed  = JSON.parse(jsonStr) as GroqWaitResult

    if (typeof parsed.minutes !== 'number' || typeof parsed.reasoning !== 'string') {
      throw new Error('Unexpected Groq response shape')
    }

    return {
      minutes:   Math.round(clamp(parsed.minutes, 1, 240)),
      reasoning: parsed.reasoning.slice(0, 200),
    }
  } catch (err) {
    console.warn('[predict-wait] Groq parse/call failed:', err instanceof Error ? err.message : err)
    return null
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function predictWaitTime(
  params: PredictWaitParams,
): Promise<WaitPrediction> {
  const {
    doctorId,
    queuePosition,
    timeOfDay,
    dayOfWeek,
    currentlyServing,
    doctorSpecialty = 'General Medicine',
  } = params

  const MIN_HISTORY = 5   // records needed for a high-confidence data-only prediction
  const FALLBACK_PER_PATIENT = 8  // minutes — used when everything else fails

  // ── 1. Fetch historical wait_minutes from completed entries ───────────────
  // We use wait_minutes (set at booking time and updated on completion) as the
  // actual elapsed time signal.  Only rows where wait_minutes is non-null and
  // status = 'done' represent real completed consultations.

  const supabase = createServiceClient()

  const { data: history, error: histErr } = await supabase
    .from('queue_entries')
    .select('wait_minutes, booked_at, status')
    .eq('doctor_id', doctorId)
    .eq('status', 'done')
    .not('wait_minutes', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (histErr) {
    console.warn('[predict-wait] history query failed:', histErr.message)
  }

  const validMinutes: number[] = (history ?? [])
    .map((r) => r.wait_minutes)
    .filter((m): m is number => typeof m === 'number' && m > 0 && m < 300)

  const historyCount = validMinutes.length
  const avgFromData  = historyCount > 0 ? mean(validMinutes) : null

  // ── 2. High-confidence path — enough historical rows ─────────────────────
  if (historyCount >= MIN_HISTORY && avgFromData != null) {
    // Adjust for currently-serving: the patient at the front is mid-consult;
    // assume half a consult remains on average.
    const servingAdjust  = currentlyServing ? avgFromData * 0.5 : 0
    const patientsAhead  = Math.max(0, queuePosition - 1)
    const rawWait        = servingAdjust + patientsAhead * avgFromData
    const minutes        = Math.max(1, Math.round(rawWait))

    return {
      minutes,
      confidence: 'high',
      basis: `Based on ${historyCount} recent consultations (avg ${avgFromData.toFixed(1)} min each).`,
    }
  }

  // ── 3. Medium-confidence path — some history but under threshold ──────────
  // Feed what we have to Groq for a calibrated estimate.
  const groqResult = await callGroqForEstimate(
    queuePosition,
    avgFromData,
    timeOfDay,
    dayOfWeek,
    doctorSpecialty,
  )

  if (groqResult) {
    const confidence: WaitPrediction['confidence'] = historyCount > 0 ? 'medium' : 'low'
    const historyNote = historyCount > 0
      ? ` (${historyCount} past visit${historyCount > 1 ? 's' : ''} referenced)`
      : ''
    return {
      minutes:    groqResult.minutes,
      confidence,
      basis: `${groqResult.reasoning}${historyNote}`,
    }
  }

  // ── 4. Fallback — Groq unavailable, no usable history ────────────────────
  const fallbackMinutes = Math.max(1, queuePosition * FALLBACK_PER_PATIENT)
  return {
    minutes:    fallbackMinutes,
    confidence: 'low',
    basis:      'Default estimate (no historical data available for this doctor).',
  }
}
