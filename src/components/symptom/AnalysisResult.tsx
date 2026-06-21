'use client'

import { Button } from '@/components/ui/Button'
import type { SymptomResult, DoctorRow } from '@/lib/types'

// ── Urgency config ────────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  low: {
    label:   'Low',
    desc:    'Routine — book an appointment in the next few days',
    dot:     'bg-mq-success',
    badge:   'bg-mq-success/10 border-mq-success/30 text-mq-success',
    border:  'border-mq-success/30',
    icon:    '🟢',
  },
  medium: {
    label:   'Medium',
    desc:    'Should be seen today',
    dot:     'bg-mq-warning',
    badge:   'bg-mq-warning/10 border-mq-warning/30 text-mq-warning',
    border:  'border-mq-warning/30',
    icon:    '🟡',
  },
  high: {
    label:   'High',
    desc:    'Prompt attention needed within hours',
    dot:     'bg-orange-500',
    badge:   'bg-orange-500/10 border-orange-500/30 text-orange-400',
    border:  'border-orange-500/30',
    icon:    '🟠',
  },
  critical: {
    label:   'Critical',
    desc:    'Potential emergency — seek immediate care',
    dot:     'bg-mq-error',
    badge:   'bg-mq-error/10 border-mq-error/30 text-mq-error',
    border:  'border-mq-error/30',
    icon:    '🔴',
  },
} as const

// ── Doctor card ───────────────────────────────────────────────────────────────

function DoctorCard({
  doctor,
  onSelect,
}: {
  doctor: DoctorRow
  onSelect: (doctorId: string) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-mq-surface-raised border border-mq-border">
      {/* Avatar placeholder */}
      <div
        className="w-9 h-9 rounded-full bg-mq-primary/10 border border-mq-primary/20
                   flex items-center justify-center shrink-0 text-sm font-semibold text-mq-primary"
        aria-hidden="true"
      >
        {doctor.name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mq-text-1 truncate">{doctor.name}</p>
        <p className="text-xs text-mq-text-3">{doctor.specialty}</p>
      </div>

      {/* Live indicator */}
      {doctor.is_live && (
        <span className="flex items-center gap-1 text-[10px] text-mq-success shrink-0">
          <span className="w-1 h-1 rounded-full bg-mq-success animate-pulse" />
          Live
        </span>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={() => onSelect(doctor.id)}
        className="shrink-0"
      >
        Select →
      </Button>
    </div>
  )
}

// ── Empty / loading state ─────────────────────────────────────────────────────

export function AnalysisResultEmpty() {
  return (
    <div className="bg-mq-surface border border-mq-border rounded-xl p-4 sm:p-5
                    flex flex-col items-center justify-center gap-3 min-h-[280px] text-center">
      <span className="text-4xl opacity-30" aria-hidden="true">🩺</span>
      <div>
        <p className="text-sm font-medium text-mq-text-2">No analysis yet</p>
        <p className="text-xs text-mq-text-3 mt-1">
          Fill in your symptoms and click Analyse to see results here.
        </p>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AnalysisResultProps {
  result:   SymptomResult
  onReset:  () => void
  onSelectDoctor: (doctorId: string) => void
}

// ── Main component ────────────────────────────────────────────────────────────

export function AnalysisResult({ result, onReset, onSelectDoctor }: AnalysisResultProps) {
  const urgency = URGENCY_CONFIG[result.urgency] ?? URGENCY_CONFIG.medium

  return (
    <div
      className={`bg-mq-surface border rounded-xl p-4 sm:p-5 space-y-4 ${urgency.border}`}
    >
      {/* ── Urgency badge ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-mq-text-2 mb-1 uppercase tracking-wide font-medium">
            Triage Assessment
          </p>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${urgency.badge}`}>
            <span className={`w-2 h-2 rounded-full ${urgency.dot}`} />
            {urgency.icon} {urgency.label} Priority
          </div>
          <p className="text-xs text-mq-text-3 mt-1">{urgency.desc}</p>
        </div>

        <Button variant="ghost" size="sm" onClick={onReset}>
          Check Again
        </Button>
      </div>

      {/* ── Possible condition ─────────────────────────────────────────── */}
      <div className="bg-mq-surface-raised border border-mq-border rounded-lg px-4 py-3">
        <p className="text-[10px] text-mq-text-3 uppercase tracking-wider mb-0.5">
          Possible Condition
        </p>
        <p className="text-base font-semibold text-mq-text-1">
          {result.possibleCondition}
        </p>
        <p className="text-xs text-mq-text-2 mt-0.5">
          Recommended: <span className="text-mq-text-1">{result.recommendedSpecialty}</span>
        </p>
      </div>

      {/* ── Analysis text ──────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-mq-text-2 uppercase tracking-wider mb-1.5 font-medium">
          Assessment
        </p>
        <p className="text-sm text-mq-text-1 leading-relaxed">{result.advice}</p>
      </div>

      {/* ── Matching doctors ───────────────────────────────────────────── */}
      {result.matchingDoctors.length > 0 && (
        <div>
          <p className="text-xs text-mq-text-2 uppercase tracking-wider mb-2 font-medium">
            Available Doctors
          </p>
          <div className="space-y-1.5">
            {result.matchingDoctors.map((doc) => (
              <DoctorCard
                key={doc.id}
                doctor={doc}
                onSelect={onSelectDoctor}
              />
            ))}
          </div>
        </div>
      )}

      {result.matchingDoctors.length === 0 && (
        <div className="rounded-lg bg-mq-surface-raised border border-mq-border px-4 py-3">
          <p className="text-xs text-mq-text-2">
            No doctors matching <span className="text-mq-text-1">{result.recommendedSpecialty}</span> are
            currently live. Please check the Patient Portal for available doctors.
          </p>
        </div>
      )}

      {/* ── Medical disclaimer ─────────────────────────────────────────── */}
      <div className="flex gap-3 rounded-lg bg-mq-warning/5 border border-mq-warning/20 px-4 py-3">
        <span className="shrink-0 text-mq-warning text-base" aria-hidden="true">⚠</span>
        <p className="text-xs text-mq-warning/90 leading-relaxed">{result.disclaimer}</p>
      </div>
    </div>
  )
}
