import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/types/database'
import type { UserRole } from '@/lib/types'

// Build a Supabase client that reads session cookies from the incoming request.
// Used only in API Route Handlers where next/headers is not available.
function createRequestClient(request: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // API routes are stateless — session refresh is handled by proxy.ts.
        },
      },
    }
  )
}

export interface AuthedUser {
  userId: string
  role:   UserRole
}

// requireRole verifies that the caller has an active session AND holds one of
// the specified roles (stored in user_metadata.role by Supabase Auth).
//
// Usage:
//   const auth = await requireRole(request, ['admin'])
//   if (isAuthError(auth)) return auth
//   // auth.userId, auth.role are now safe to use
//
// Returns an AuthedUser on success or a NextResponse (401/403) on failure.
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<AuthedUser | NextResponse> {
  const supabase = createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized — valid session required' },
      { status: 401 }
    )
  }

  const role = (user.user_metadata?.role ?? '') as UserRole

  if (!allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: `Forbidden — requires one of: ${allowedRoles.join(', ')}` },
      { status: 403 }
    )
  }

  return { userId: user.id, role }
}

// Type guard: distinguishes a NextResponse error from a successful AuthedUser.
export function isAuthError(result: AuthedUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
