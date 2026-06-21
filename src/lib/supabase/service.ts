import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

// Server-only service-role client.
// Bypasses Supabase RLS — only use in API Route Handlers, never in components.
// NEVER import this file in a path that might be bundled client-side.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service-role environment variables')
  return createClient<Database>(url, key, { auth: { persistSession: false } })
}
