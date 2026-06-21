import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          // Write refreshed session cookies onto the request so downstream
          // Server Components see the updated session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Rebuild the response to carry the new Set-Cookie headers forward.
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          // Propagate cache-control headers set by the library so CDNs never
          // cache auth responses.
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() must be called here — this is what triggers the
  // token refresh and causes setAll to run when the session is near expiry.
  // Do NOT remove this call or session refresh will silently stop working.
  await supabase.auth.getUser()

  return supabaseResponse
}
