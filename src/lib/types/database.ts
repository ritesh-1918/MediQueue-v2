/**
 * Supabase database types — hand-authored from the migration SQL.
 * Re-generate with `supabase gen types typescript` once the project is linked.
 *
 * Shape mirrors the migration at:
 * supabase/migrations/20260621141003_initial_schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      patients: {
        Row: {
          id:         string       // uuid
          name:       string
          phone:      string
          created_at: string       // timestamptz as ISO string
        }
        Insert: {
          id?:        string
          name:       string
          phone:      string
          created_at?: string
        }
        Update: {
          id?:        string
          name?:      string
          phone?:     string
          created_at?: string
        }
        Relationships: []
      }

      doctors: {
        Row: {
          id:            string   // uuid
          name:          string
          specialty:     string
          is_live:       boolean
          served_count:  number
          skipped_count: number
          created_at:    string   // timestamptz as ISO string
        }
        Insert: {
          id?:            string
          name:           string
          specialty:      string
          is_live?:       boolean
          served_count?:  number
          skipped_count?: number
          created_at?:    string
        }
        Update: {
          id?:            string
          name?:          string
          specialty?:     string
          is_live?:       boolean
          served_count?:  number
          skipped_count?: number
          created_at?:    string
        }
        Relationships: []
      }

      queue_entries: {
        Row: {
          id:           string           // uuid
          patient_id:   string           // uuid → patients.id
          doctor_id:    string           // uuid → doctors.id
          token_number: number
          status:       QueueStatusEnum
          wait_minutes: number | null
          booked_at:    string           // timestamptz as ISO string
          created_at:   string           // timestamptz as ISO string
        }
        Insert: {
          id?:           string
          patient_id:    string
          doctor_id:     string
          token_number:  number
          status?:       QueueStatusEnum
          wait_minutes?: number | null
          booked_at?:    string
          created_at?:   string
        }
        Update: {
          id?:           string
          patient_id?:   string
          doctor_id?:    string
          token_number?: number
          status?:       QueueStatusEnum
          wait_minutes?: number | null
          booked_at?:    string
          created_at?:   string
        }
        Relationships: [
          {
            foreignKeyName: 'queue_entries_patient_id_fkey'
            columns:        ['patient_id']
            referencedRelation: 'patients'
            referencedColumns:  ['id']
          },
          {
            foreignKeyName: 'queue_entries_doctor_id_fkey'
            columns:        ['doctor_id']
            referencedRelation: 'doctors'
            referencedColumns:  ['id']
          },
        ]
      }

      activity_log: {
        Row: {
          id:         string              // uuid
          message:    string
          type:       ActivityLogTypeEnum
          created_at: string              // timestamptz as ISO string
        }
        Insert: {
          id?:        string
          message:    string
          type?:      ActivityLogTypeEnum
          created_at?: string
        }
        Update: {
          id?:        string
          message?:   string
          type?:      ActivityLogTypeEnum
          created_at?: string
        }
        Relationships: []
      }
    }

    Views:   Record<string, never>
    Functions: {
      next_token_number: {
        Args:    { p_doctor_id: string }
        Returns: number
      }
    }
    Enums:   Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ── Inline enum types (checked against the SQL CHECK constraints) ────────────

export type QueueStatusEnum =
  | 'waiting'
  | 'called'
  | 'serving'
  | 'done'
  | 'skipped'
  | 'cancelled'

export type ActivityLogTypeEnum =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

// ── Convenience row aliases ───────────────────────────────────────────────────

export type PatientRow      = Database['public']['Tables']['patients']['Row']
export type DoctorRow       = Database['public']['Tables']['doctors']['Row']
export type QueueEntryRow   = Database['public']['Tables']['queue_entries']['Row']
export type ActivityLogRow  = Database['public']['Tables']['activity_log']['Row']
