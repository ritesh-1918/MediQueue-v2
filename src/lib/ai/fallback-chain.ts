// ── AI Fallback Chain ─────────────────────────────────────────────────────────
//
// Tries 9 free-tier provider slots in order. On 429 or any error the slot is
// skipped and the next is tried immediately. If all 9 fail, returns a graceful
// "unavailable" response so the patient flow is never hard-blocked.
//
// Slot order:
//   1-3  Gemini 1.5 Flash         (GEMINI_API_KEY_1/2/3)
//   4-6  OpenRouter Mistral-7B    (OPENROUTER_API_KEY_1/2/3)
//   7-8  Groq LLaMA3-8B           (GROQ_API_KEY_1/2)
//   9    Hugging Face Mistral-7B  (HUGGINGFACE_API_KEY)

// ── Shared result type ────────────────────────────────────────────────────────

export interface SymptomAnalysis {
  urgency:              'low' | 'medium' | 'high' | 'critical'
  possibleCondition:    string
  recommendedSpecialty: string
  advice:               string
  disclaimer:           string
  provider:             string   // which slot succeeded — logged server-side
}

// ── Provider interface ────────────────────────────────────────────────────────

export interface AIProvider {
  name:   string
  apiKey: string | undefined
  callFn: (prompt: string, apiKey: string) => Promise<string>
}

// ── Shared prompt builder ─────────────────────────────────────────────────────

function buildPrompt(symptoms: string, age: number, duration: string): string {
  return `You are a medical AI assistant. A ${age} year old patient reports: ${symptoms} (duration: ${duration}).
Analyze and respond ONLY in this JSON format:
{
  "condition": "<brief possible condition>",
  "urgency": "low" | "medium" | "high" | "critical",
  "specialty": "General Medicine" | "Cardiology" | "Dermatology" | "Orthopedics" | "Neurology" | "Pediatrics",
  "advice": "<2-3 sentences of guidance>",
  "disclaimer": "This is AI guidance only, not a medical diagnosis. Please consult a doctor."
}`
}

// ── Gemini 1.5 Flash ──────────────────────────────────────────────────────────

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini: empty response')
  return text
}

// ── OpenRouter (Mistral-7B-Instruct:free) ─────────────────────────────────────

async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer':  'https://mediqueue.vercel.app',
      'X-Title':       'MediQueue',
    },
    body: JSON.stringify({
      model:       'mistralai/mistral-7b-instruct:free',
      temperature: 0.3,
      max_tokens:  500,
      messages:    [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenRouter: empty response')
  return text
}

// ── Groq (LLaMA3-8B-8192) ────────────────────────────────────────────────────

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       'llama3-8b-8192',
      temperature: 0.3,
      max_tokens:  500,
      messages:    [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`)
  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Groq: empty response')
  return text
}

// ── Hugging Face (Mistral-7B-Instruct-v0.2) ───────────────────────────────────

async function callHuggingFace(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  )
  if (!res.ok) throw new Error(`HuggingFace HTTP ${res.status}`)
  const data = await res.json() as Array<{ generated_text: string }>
  const text = data?.[0]?.generated_text
  if (!text) throw new Error('HuggingFace: empty response')
  // HF echoes the prompt — strip it to get only the generated continuation
  return text.startsWith(prompt) ? text.slice(prompt.length).trim() : text
}

// ── Provider chain (9 slots) ──────────────────────────────────────────────────

function buildChain(): AIProvider[] {
  const e = process.env
  return [
    { name: 'gemini-1',      apiKey: e.GEMINI_API_KEY_1,      callFn: callGemini      },
    { name: 'gemini-2',      apiKey: e.GEMINI_API_KEY_2,      callFn: callGemini      },
    { name: 'gemini-3',      apiKey: e.GEMINI_API_KEY_3,      callFn: callGemini      },
    { name: 'openrouter-1',  apiKey: e.OPENROUTER_API_KEY_1,  callFn: callOpenRouter  },
    { name: 'openrouter-2',  apiKey: e.OPENROUTER_API_KEY_2,  callFn: callOpenRouter  },
    { name: 'openrouter-3',  apiKey: e.OPENROUTER_API_KEY_3,  callFn: callOpenRouter  },
    { name: 'groq-1',        apiKey: e.GROQ_API_KEY_1,        callFn: callGroq        },
    { name: 'groq-2',        apiKey: e.GROQ_API_KEY_2,        callFn: callGroq        },
    { name: 'huggingface',   apiKey: e.HUGGINGFACE_API_KEY,   callFn: callHuggingFace },
  ]
}

// ── JSON extraction helper ────────────────────────────────────────────────────
// Models sometimes wrap JSON in markdown fences — strip them before parsing.

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const brace = raw.indexOf('{')
  const last  = raw.lastIndexOf('}')
  if (brace !== -1 && last !== -1 && last > brace) return raw.slice(brace, last + 1)
  return raw.trim()
}

// ── Parsed shape from models ──────────────────────────────────────────────────

interface RawModelResult {
  condition?: string
  urgency?:   string
  specialty?: string
  advice?:    string
  disclaimer?: string
}

const URGENCY_VALUES = ['low', 'medium', 'high', 'critical'] as const
type Urgency = (typeof URGENCY_VALUES)[number]

// ── analyzeSymptoms — main export ─────────────────────────────────────────────

export async function analyzeSymptoms(
  symptoms: string,
  age:      number,
  duration: string
): Promise<SymptomAnalysis> {
  const prompt = buildPrompt(symptoms, age, duration)
  const chain  = buildChain()

  for (const provider of chain) {
    if (!provider.apiKey) {
      console.log(`[ai-chain] skipping ${provider.name} — no key configured`)
      continue
    }

    try {
      const raw    = await provider.callFn(prompt, provider.apiKey)
      const json   = extractJSON(raw)
      const parsed = JSON.parse(json) as RawModelResult

      const urgency = URGENCY_VALUES.includes(parsed.urgency as Urgency)
        ? (parsed.urgency as Urgency)
        : 'medium'

      const result: SymptomAnalysis = {
        urgency,
        possibleCondition:    parsed.condition    ?? 'Unable to determine',
        recommendedSpecialty: parsed.specialty    ?? 'General Medicine',
        advice:               parsed.advice       ?? 'Please consult a doctor for further evaluation.',
        disclaimer:           parsed.disclaimer   ?? 'This is AI guidance only, not a medical diagnosis. Please consult a doctor.',
        provider:             provider.name,
      }

      console.log(`[ai-chain] success via ${provider.name}`)
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[ai-chain] ${provider.name} failed: ${msg}`)
      // continue to next slot
    }
  }

  // All 9 slots exhausted
  console.error('[ai-chain] all providers failed — returning fallback response')
  return {
    urgency:              'medium',
    possibleCondition:    'Unable to assess',
    recommendedSpecialty: 'General Medicine',
    advice:               'AI temporarily unavailable, please consult reception. A member of staff will assist you with triage.',
    disclaimer:           'This is AI guidance only, not a medical diagnosis. Please consult a doctor.',
    provider:             'fallback',
  }
}
