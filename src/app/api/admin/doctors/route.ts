import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

// ── GET /api/admin/doctors ────────────────────────────────────────────────────
// Returns all doctors ordered by name, with full stats columns.

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (isAuthError(auth)) return auth

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('doctors')
    .select('id, name, specialty, is_live, served_count, skipped_count, created_at')
    .order('name', { ascending: true })

  if (error) {
    console.error('[admin/doctors] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 })
  }

  return NextResponse.json({ doctors: data ?? [] })
}

// ── POST /api/admin/doctors ───────────────────────────────────────────────────
// Creates a new doctor. Defaults is_live to false.
// Body: { name: string, specialty: string }

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (isAuthError(auth)) return auth

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, specialty } = (body ?? {}) as Record<string, unknown>

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (typeof specialty !== 'string' || !specialty.trim()) {
    return NextResponse.json({ error: 'specialty is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('doctors')
    .insert({
      name:      name.trim(),
      specialty: specialty.trim(),
      is_live:   false,
    })
    .select('id, name, specialty, is_live, served_count, skipped_count, created_at')
    .single()

  if (error || !data) {
    console.error('[admin/doctors] POST error:', error)
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A doctor with that name already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 })
  }

  await supabase.from('activity_log').insert({
    message: `Doctor added: ${data.name} (${data.specialty})`,
    type:    'info',
  })

  return NextResponse.json({ doctor: data }, { status: 201 })
}
