'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import type { DoctorRow } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingConfirmation {
  tokenNumber:   number
  tokenLabel:    string
  queueEntryId:  string
  position:      number
  estimatedWait: number
  doctorName:    string
}

// ── Token confirmation card ───────────────────────────────────────────────────

function TokenConfirmationCard({ confirmation }: { confirmation: BookingConfirmation }) {
  return (
    <Card className="text-center space-y-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-medium text-mq-text-2 uppercase tracking-widest">
          Your Token
        </span>
        <span className="text-5xl font-bold tabular-nums text-mq-primary">
          {confirmation.tokenLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="bg-mq-surface-raised rounded-lg p-3 border border-mq-border">
          <p className="text-xs text-mq-text-2 mb-1">Position</p>
          <p className="text-2xl font-semibold text-mq-text-1 tabular-nums">
            #{confirmation.position}
          </p>
        </div>
        <div className="bg-mq-surface-raised rounded-lg p-3 border border-mq-border">
          <p className="text-xs text-mq-text-2 mb-1">Est. Wait</p>
          <p className="text-2xl font-semibold text-mq-text-1 tabular-nums">
            ~{confirmation.estimatedWait}m
          </p>
        </div>
      </div>

      <p className="text-xs text-mq-text-2 pt-1">
        Booked with{' '}
        <span className="text-mq-text-1 font-medium">{confirmation.doctorName}</span>
        . You will be called by your token number.
      </p>

      <div className="flex items-center gap-1.5 justify-center text-xs text-mq-success">
        <span className="w-1.5 h-1.5 rounded-full bg-mq-success animate-pulse" />
        Watching queue live
      </div>
    </Card>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function BookingForm() {
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [doctorId, setDoctorId] = useState('')

  const [doctors,      setDoctors]      = useState<DoctorRow[]>([])
  const [loadingDocs,  setLoadingDocs]  = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null)

  // ── Fetch live doctors on mount ────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function fetchDoctors() {
      try {
        const res  = await fetch('/api/doctors?live=true')
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error ?? 'Failed to load doctors')
          return
        }
        const list: DoctorRow[] = json.doctors ?? []
        setDoctors(list)
        if (list.length > 0) setDoctorId(list[0].id)
      } catch {
        if (!cancelled) setError('Could not reach the server')
      } finally {
        if (!cancelled) setLoadingDocs(false)
      }
    }
    fetchDoctors()
    return () => { cancelled = true }
  }, [])

  // ── Submit booking ─────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim())    { setError('Please enter your name');         return }
    if (!phone.trim())   { setError('Please enter your phone number'); return }
    if (!doctorId)       { setError('Please select a doctor');         return }

    setSubmitting(true)
    try {
      const res  = await fetch('/api/tokens/book', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, phone, doctor_id: doctorId }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Booking failed — please try again')
        return
      }

      setConfirmation(json as BookingConfirmation)
    } catch {
      setError('Network error — please check your connection')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Post-booking state ─────────────────────────────────────────────────

  if (confirmation) {
    return (
      <div className="space-y-3">
        <TokenConfirmationCard confirmation={confirmation} />
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          onClick={() => {
            setConfirmation(null)
            setName('')
            setPhone('')
          }}
        >
          Book another token
        </Button>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardTitle
        action={
          <span className="text-[10px] font-mono text-mq-text-3 bg-mq-surface-raised px-1.5 py-0.5 rounded border border-mq-border">
            POST /api/tokens/book
          </span>
        }
      >
        Book Token
      </CardTitle>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {/* Name */}
        <div>
          <label
            htmlFor="booking-name"
            className="block text-xs text-mq-text-2 mb-1"
          >
            Your Name
          </label>
          <input
            id="booking-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Arjun Sharma"
            autoComplete="name"
            className="w-full h-9 px-3 rounded-lg text-sm
                       bg-mq-surface-raised border border-mq-border
                       text-mq-text-1 placeholder:text-mq-text-3
                       focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                       transition-colors"
          />
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="booking-phone"
            className="block text-xs text-mq-text-2 mb-1"
          >
            Phone Number
          </label>
          <input
            id="booking-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            autoComplete="tel"
            className="w-full h-9 px-3 rounded-lg text-sm
                       bg-mq-surface-raised border border-mq-border
                       text-mq-text-1 placeholder:text-mq-text-3
                       focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                       transition-colors"
          />
        </div>

        {/* Doctor select */}
        <div>
          <label
            htmlFor="booking-doctor"
            className="block text-xs text-mq-text-2 mb-1"
          >
            Select Doctor
          </label>
          {loadingDocs ? (
            <div className="h-9 rounded-lg bg-mq-surface-raised border border-mq-border animate-pulse" />
          ) : doctors.length === 0 ? (
            <p className="text-xs text-mq-warning py-2">
              No doctors are currently available. Please check back shortly.
            </p>
          ) : (
            <select
              id="booking-doctor"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg text-sm
                         bg-mq-surface-raised border border-mq-border
                         text-mq-text-1
                         focus:outline-none focus:border-mq-primary focus:ring-1 focus:ring-mq-primary
                         transition-colors"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.specialty}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && (
          <p
            role="alert"
            className="text-xs text-mq-error bg-mq-error-bg border border-mq-error/30 rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={submitting}
          loadingText="Booking…"
          disabled={loadingDocs || doctors.length === 0}
        >
          Get My Token →
        </Button>
      </form>
    </Card>
  )
}
