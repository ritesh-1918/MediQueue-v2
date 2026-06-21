'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CardTitle } from '@/components/ui/Card'
import type { DoctorRow } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DoctorListProps {
  initialDoctors: DoctorRow[]
}

// ── Doctor row ────────────────────────────────────────────────────────────────

function DoctorRow_({ doctor }: { doctor: DoctorRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-mq-surface-raised border border-mq-border">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full bg-mq-primary/10 border border-mq-primary/20
                   flex items-center justify-center shrink-0 text-xs font-semibold text-mq-primary"
        aria-hidden="true"
      >
        {doctor.name.charAt(0).toUpperCase()}
      </div>

      {/* Name + specialty */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mq-text-1 truncate">{doctor.name}</p>
        <p className="text-xs text-mq-text-3 truncate">{doctor.specialty}</p>
      </div>

      {/* Served / skipped counts */}
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <div className="text-center">
          <p className="text-sm font-semibold tabular-nums text-mq-success">{doctor.served_count}</p>
          <p className="text-[10px] text-mq-text-3">Served</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold tabular-nums text-mq-warning">{doctor.skipped_count}</p>
          <p className="text-[10px] text-mq-text-3">Skipped</p>
        </div>
      </div>

      {/* Live badge */}
      {doctor.is_live ? (
        <span className="flex items-center gap-1 text-[10px] font-medium text-mq-success bg-mq-success/10 border border-mq-success/20 rounded-full px-2 py-0.5 shrink-0">
          <span className="w-1 h-1 rounded-full bg-mq-success animate-pulse" />
          Live
        </span>
      ) : (
        <span className="text-[10px] font-medium text-mq-text-3 bg-mq-surface border border-mq-border rounded-full px-2 py-0.5 shrink-0">
          Offline
        </span>
      )}
    </div>
  )
}

// ── Add doctor form ───────────────────────────────────────────────────────────

function AddDoctorForm({ onAdded }: { onAdded: (doctor: DoctorRow) => void }) {
  const [name,      setName]      = useState('')
  const [specialty, setSpecialty] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [open,      setOpen]      = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim())      { setError('Name is required');      return }
    if (!specialty.trim()) { setError('Specialty is required'); return }

    setLoading(true)
    try {
      const res  = await fetch('/api/admin/doctors', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, specialty }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to add doctor')
        return
      }

      onAdded(json.doctor as DoctorRow)
      setName('')
      setSpecialty('')
      setOpen(false)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        leftIcon={<span aria-hidden="true">+</span>}
      >
        Add Doctor
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 bg-mq-surface-raised border border-mq-border rounded-xl p-4">
      <p className="text-xs font-medium text-mq-text-1 mb-3">New Doctor</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="doc-name" className="block text-[10px] text-mq-text-3 mb-1">
            Full Name
          </label>
          <input
            id="doc-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Meera Iyer"
            className="w-full h-8 px-3 rounded-lg text-xs bg-mq-surface border border-mq-border
                       text-mq-text-1 placeholder:text-mq-text-3
                       focus:outline-none focus:border-mq-primary transition-colors"
          />
        </div>
        <div>
          <label htmlFor="doc-spec" className="block text-[10px] text-mq-text-3 mb-1">
            Specialty
          </label>
          <input
            id="doc-spec"
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="Cardiology"
            className="w-full h-8 px-3 rounded-lg text-xs bg-mq-surface border border-mq-border
                       text-mq-text-1 placeholder:text-mq-text-3
                       focus:outline-none focus:border-mq-primary transition-colors"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-mq-error">{error}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" variant="primary" size="sm" loading={loading} loadingText="Adding…">
          Add Doctor
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { setOpen(false); setError(null) }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ── DoctorList ────────────────────────────────────────────────────────────────

export function DoctorList({ initialDoctors }: DoctorListProps) {
  const [doctors, setDoctors] = useState<DoctorRow[]>(initialDoctors)

  function handleAdded(doctor: DoctorRow) {
    setDoctors((prev) => [...prev, doctor].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const liveCount = doctors.filter((d) => d.is_live).length

  return (
    <div className="bg-mq-surface border border-mq-border rounded-xl p-4 sm:p-5 space-y-3">
      <CardTitle
        action={
          <span className="text-[10px] font-medium text-mq-success bg-mq-success/10 border border-mq-success/20 rounded-full px-2 py-0.5">
            {liveCount} live
          </span>
        }
      >
        Doctors ({doctors.length})
      </CardTitle>

      {doctors.length === 0 ? (
        <p className="text-xs text-mq-text-3 py-4 text-center">No doctors yet</p>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {doctors.map((d) => (
            <DoctorRow_ key={d.id} doctor={d} />
          ))}
        </div>
      )}

      <div className="pt-1">
        <AddDoctorForm onAdded={handleAdded} />
      </div>
    </div>
  )
}
