'use client'

// Symptom checker page is client-rendered: it owns shared state between
// SymptomForm (input) and AnalysisResult (output) and must respond to
// doctor selection by navigating to the Patient Portal with a pre-selected doctor.

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SymptomForm } from '@/components/symptom/SymptomForm'
import { AnalysisResult, AnalysisResultEmpty } from '@/components/symptom/AnalysisResult'
import type { SymptomResult } from '@/lib/types'

export default function SymptomCheckPage() {
  const router = useRouter()
  const [result, setResult] = useState<SymptomResult | null>(null)

  function handleResult(r: SymptomResult) {
    setResult(r)
    // On mobile, scroll the result panel into view after analysis completes
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById('symptom-result')?.scrollIntoView({
          behavior: 'smooth',
          block:    'start',
        })
      }, 100)
    }
  }

  function handleReset() {
    setResult(null)
  }

  // Navigate to patient portal with doctor pre-selected
  function handleSelectDoctor(doctorId: string) {
    router.push(`/patient?doctor_id=${doctorId}`)
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-mq-text-1 tracking-tight">
          AI Symptom Checker
        </h1>
        <p className="text-xs text-mq-text-2 mt-0.5">
          Describe your symptoms for a quick triage assessment. Not a substitute for medical
          advice.
        </p>
      </div>

      {/*
        Two-column layout on lg+.
        Form stays on the left; result panel on the right.
        On mobile they stack — form first, result below (with smooth scroll).
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left — symptom input form */}
        <SymptomForm onResult={handleResult} />

        {/* Right — analysis result */}
        <div id="symptom-result">
          {result ? (
            <AnalysisResult
              result={result}
              onReset={handleReset}
              onSelectDoctor={handleSelectDoctor}
            />
          ) : (
            <AnalysisResultEmpty />
          )}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-mq-text-3 text-center mt-8">
        AI analysis powered by GPT-4o mini. Results are for initial triage only and must be
        reviewed by a qualified clinician.
      </p>
    </div>
  )
}
