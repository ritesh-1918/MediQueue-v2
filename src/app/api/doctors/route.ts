import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/supabase/api-auth'
import { createServiceClient } from '@/lib/supabase/service'

type DoctorUpdate = import('@/lib/types/database').Database['public']['Tables']['doctors']['Update']

// ── GET /api/doctors ──────────────────────────────────────────────────────────
// ?live=true — only return doctors where is_live = true (used by booking form)
// No query param — return all doctors (admin use)
// Public: intentionally unauthenticated — BookingForm needs the list without a session.

export async function GET(request: NextRequest) {
  const supabase    = createServiceClient()
  const { searchParams } = request.nextUrl
  const liveOnly    = searchParams.get('live') === 'true'

  let query = supabase
    .from('doctors')
    .select('id, name, specialty, is_live')
    .order('name', { ascending: true })

  if (liveOnly) {
    query = query.eq('is_live', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('[doctors] fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 })
  }

  return NextResponse.json({ doctors: data ?? [] })
}

// ── POST /api/doctors ─────────────────────────────────────────────────────────
// Admin: create a new doctor.

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (isAuthError(auth)) return auth

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, specialty } = body as Record<string, unknown>

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('doctors')
    .insert({
      name:      name.trim(),
      specialty: typeof specialty === 'string' ? specialty.trim() : 'General',
      is_live:   false,
    })
    .select('id, name, specialty, is_live')
    .single()

  if (error || !data) {
    console.error('[doctors] insert error:', error)
    return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 })
  }

  return NextResponse.json({ doctor: data }, { status: 201 })
}

// ── PATCH /api/doctors ────────────────────────────────────────────────────────
// Admin: update doctor fields (e.g. toggle is_live).

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ['admin'])
  if (isAuthError(auth)) return auth

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, ...updates } = body as Record<string, unknown>

  if (typeof id !== 'string' || !id.trim()) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Whitelist updatable fields
  const allowed: DoctorUpdate = {}
  if (typeof updates.name      === 'string')  allowed.name      = updates.name.trim()
  if (typeof updates.specialty === 'string')  allowed.specialty = updates.specialty.trim()
  if (typeof updates.is_live   === 'boolean') allowed.is_live   = updates.is_live

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('doctors')
    .update(allowed)
    .eq('id', id)
    .select('id, name, specialty, is_live')
    .single()

  if (error || !data) {
    console.error('[doctors] update error:', error)
    return NextResponse.json({ error: 'Failed to update doctor' }, { status: 500 })
  }

  return NextResponse.json({ doctor: data })
}
