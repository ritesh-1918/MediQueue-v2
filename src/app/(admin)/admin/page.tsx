import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { StatsCards }   from '@/components/admin/StatsCards'
import { DoctorList }   from '@/components/admin/DoctorList'
import { TokensChart }  from '@/components/admin/TokensChart'
import { ActivityFeed } from '@/components/admin/ActivityFeed'
import type { DoctorRow } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Manage doctors, monitor queue stats, and review activity logs.',
}

// Revalidate this page every 30 seconds so the server-fetched doctor list
// stays reasonably fresh for direct navigations.
export const revalidate = 30

// ── Server-side data fetch ────────────────────────────────────────────────────

async function fetchDoctors(): Promise<DoctorRow[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('doctors')
      .select('id, name, specialty, is_live, served_count, skipped_count, created_at')
      .order('name', { ascending: true })

    if (error) {
      console.error('[admin/page] fetchDoctors error:', error)
      return []
    }

    return (data ?? []) as DoctorRow[]
  } catch (err) {
    console.error('[admin/page] fetchDoctors threw:', err)
    return []
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const doctors = await fetchDoctors()

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-mq-text-1 tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-xs text-mq-text-2 mt-0.5">
          Live clinic overview — stats refresh every 30 seconds.
        </p>
      </div>

      {/* ── Row 1: KPI stats strip ── */}
      <StatsCards />

      {/* ── Row 2: Tokens chart (full width) ── */}
      <TokensChart />

      {/* ── Row 3: Doctor list (left) + Activity feed (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <DoctorList initialDoctors={doctors} />
        <ActivityFeed />
      </div>
    </div>
  )
}
