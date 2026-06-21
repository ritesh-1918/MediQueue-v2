'use client'

import { useState } from 'react'
import { Button }      from '@/components/ui/Button'
import { VoiceInput }  from '@/components/symptom/VoiceInput'
import type { SymptomResult } from '@/lib/types'

// ── Config ────────────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { value: '1 day',    label: 'Started today (< 1 day)'  },
  { value: '2-3 days', label: '2–3 days'                 },
  { value: '1 week',   label: 'About a week'             },
  { value: 'recently', label: '2–4 weeks'                },
  { value: 'chronic',  label: 'Ongoing / chronic'        },
] as const

const QUICK_CHIPS = [
  'Fever',
  'Cough',
  'Chest pain',
  'Shortness of breath',
  'Palpitations',
  'Skin rash',
  'Headache',
  'Dizziness',
  'Fatigue',
  'Nausea',
  'Body ache',
  'Sore throat',
] as const

// ── Props ─────────────────────────────────────────────────────────────────────

interface SymptomFormProps {
  onResult: (result: SymptomResult) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SymptomForm({ onResult }: SymptomFormProps) {
  const [age,        setAge]        = useState<string>('')
  const [duration,   setDuration]   = useState<string>(DURATION_OPTIONS[0].value)
  const [symptoms,   setSymptoms]   = useState<string>('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [activeChip, setActiveChip] = useState<Set<string>>(new Set())

  // ── Quick-chip toggle ──────────────────────────────────────────────────────

  function toggleChip(chip: string) {
    setActiveChip((prev) => {
      const next = new Set(prev)
      if (next.has(chip)) {
        next.delete(chip)
        setSymptoms((s) =>
          s
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.toLowerCase() !== chip.toLowerCase())
            .join(', ')
        )
      } else {
        next.add(chip)
        setSymptoms((s) => {
          const trimmed = s.trim()
          return trimmed ? `${trimmed}, ${chip}` : chip
        })
      }
      return next
    })
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const ageNum = parseInt(age, 10)
    if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      setError('Please enter a valid age (1–120)')
      return
    }
    if (!symptoms.trim() || symptoms.trim().length < 3) {
      setError('Please describe your symptoms (at least 3 characters)')
      return
    }

    setLoading(true)
    try {
      const res  = await fetch('/api/ai/symptom-check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ symptoms, age: ageNum, duration }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Analysis failed — please try again')
        return
      }

      onResult(json as SymptomResult)
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-mq-surface border border-mq-border rounded-xl p-4 sm:p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg" aria-hidden="true">🔍</span>
          <h2 className="text-sm font-semibold text-mq-text-1">AI Symptom Checker</h2>
        </div>
        <p className="text-xs text-mq-text-2">
          Describe your symptoms for an AI triage assessment. This does not replace a doctor.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Age + Duration row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sc-age" className="block text-xs text-mq-text-2 mb-1">
              Age
            </label>
            <input
              id="sc-age"
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 35"
              className="w-full h-9 px-3 rounded-lg text-sm
                         bg-mq-surface-raised border border-mq-border
                         text-mq-text-1 placeholder:text-mq-text-3
                         focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                         transition-colors"
            />
          </div>

          <div>
            <label htmlFor="sc-duration" className="block text-xs text-mq-text-2 mb-1">
              Duration
            </label>
            <select
              id="sc-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full h-9 px-3 rounded-lg text-sm
                         bg-mq-surface-raised border border-mq-border
                         text-mq-text-1
                         focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                         transition-colors"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick-add chips */}
        <div>
          <p className="text-xs text-mq-text-2 mb-2">Quick-add symptoms</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CHIPS.map((chip) => {
              const active = activeChip.has(chip)
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleChip(chip)}
                  className={[
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mq-primary',
                    active
                      ? 'bg-mq-primary/15 border-mq-primary/60 text-mq-primary'
                      : 'bg-mq-surface-raised border-mq-border text-mq-text-2 hover:border-mq-border-strong hover:text-mq-text-1',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  {chip}
                </button>
              )
            })}
          </div>
        </div>

        {/* Symptoms textarea + voice input */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label htmlFor="sc-symptoms" className="block text-xs text-mq-text-2">
              Describe your symptoms
              <span className="text-mq-text-3 font-normal ml-1">(in your own words)</span>
            </label>
            <span className="text-[10px] text-mq-text-3 italic">or speak your symptoms</span>
          </div>

          <div className="relative flex items-start gap-2">
            <textarea
              id="sc-symptoms"
              rows={4}
              maxLength={1000}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. I have a high fever since yesterday, my throat hurts when swallowing, and I feel very weak…"
              className="flex-1 px-3 py-2 rounded-lg text-sm resize-none
                         bg-mq-surface-raised border border-mq-border
                         text-mq-text-1 placeholder:text-mq-text-3
                         focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                         transition-colors"
            />
            <VoiceInput
              onTranscript={(text) =>
                setSymptoms((prev) => {
                  const trimmed = prev.trim()
                  return trimmed ? `${trimmed} ${text}` : text
                })
              }
              disabled={loading}
            />
          </div>

          <p className="text-[10px] text-mq-text-3 mt-1 text-right">
            {symptoms.trim().length} chars
          </p>
        </div>

        {/* Error */}
        {error && (
          <p
            role="alert"
            className="text-xs text-mq-error bg-mq-error/5 border border-mq-error/20 rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={loading}
          loadingText="Analysing symptoms…"
        >
          Analyse Symptoms →
        </Button>
      </form>
    </div>
  )
}
