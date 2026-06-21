// Re-export everything from database types so consumers only need one import.
export type {
  Database,
  Json,
  QueueStatusEnum,
  ActivityLogTypeEnum,
  PatientRow,
  DoctorRow,
  QueueEntryRow,
  ActivityLogRow,
} from './database'

// ── QueueStatus enum object ───────────────────────────────────────────────────
// Provides runtime values (for comparisons, switch statements, dropdowns)
// mirroring the SQL CHECK constraint on queue_entries.status.

export const QueueStatus = {
  WAITING:   'waiting',
  CALLED:    'called',
  SERVING:   'serving',
  DONE:      'done',
  SKIPPED:   'skipped',
  CANCELLED: 'cancelled',
} as const

export type QueueStatus = (typeof QueueStatus)[keyof typeof QueueStatus]

// ── ActivityLogType enum object ───────────────────────────────────────────────

export const ActivityLogType = {
  INFO:    'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR:   'error',
} as const

export type ActivityLogType = (typeof ActivityLogType)[keyof typeof ActivityLogType]

// ── User roles ────────────────────────────────────────────────────────────────
// Stored in Supabase Auth user_metadata.role

export const UserRoles = {
  PATIENT: 'patient',
  DOCTOR:  'doctor',
  ADMIN:   'admin',
} as const

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles]

// ── App-level types (enriched beyond raw DB rows) ────────────────────────────

import type { PatientRow, DoctorRow, QueueEntryRow } from './database'

/** Queue entry with the joined patient name for display. */
export type QueueEntryWithPatient = QueueEntryRow & {
  patient: Pick<PatientRow, 'name' | 'phone'>
}

/** Doctor with the count of currently waiting patients. */
export type DoctorWithQueueCount = DoctorRow & {
  waitingCount: number
}

/** Structured response from the AI symptom checker. */
export type SymptomResult = {
  urgency:              'low' | 'medium' | 'high' | 'critical'
  possibleCondition:    string
  recommendedSpecialty: string
  advice:               string
  disclaimer:           string
  matchingDoctors:      DoctorRow[]
}

/** Shape returned by POST /api/tokens on success. */
export type TokenIssuedResponse = {
  tokenNumber:   number
  tokenLabel:    string   // e.g. "T-042"
  queueEntryId:  string
  position:      number
  estimatedWait: number   // minutes
}

/** Shape of a toast notification used by ToastProvider. */
export type ToastMessage = {
  id:      string
  type:    ActivityLogType
  title:   string
  message: string
}
