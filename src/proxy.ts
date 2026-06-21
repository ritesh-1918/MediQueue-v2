import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'
import type { UserRole } from '@/lib/types'

// Routes that require authentication, keyed by the role that may access them.
// Any role not listed for a path will be redirected to their own home.
const PROTECTED_ROUTES: Record<string, UserRole[]> = {
  '/patient':       ['patient', 'admin'],
  '/symptom-check': ['patient', 'admin'],
  '/doctor':        ['doctor',  'admin'],
  '/admin':         ['admin'],
}

// Routes that must NOT be accessible when already authenticated.
const AUTH_ROUTES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  // Step 1: Refresh the Supabase session cookie on every request.
  // This returns the response with updated Set-Cookie headers if needed.
  const response = await updateSession(request)

  const { pathname } = request.nextUrl

  // Step 2: Determine if this path requires protection.
  const matchedPath = Object.keys(PROTECTED_ROUTES).find((route) =>
    pathname.startsWith(route)
  )
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))

  // Fast exit: public routes and API routes need no further checks.
  if (!matchedPath && !isAuthRoute) return response

  // Step 3: Read the verified user from the refreshed session.
  // We build a lightweight client directly from request cookies so we don't
  // spin up the full server client (which requires awaiting next/headers).
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // setAll is handled by updateSession above; nothing to do here.
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const role = (user?.user_metadata?.role ?? null) as UserRole | null

  // Step 4: Redirect unauthenticated users away from protected routes.
  if (matchedPath && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Step 5: Redirect authenticated users away from auth routes.
  if (isAuthRoute && user) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = roleHome(role)
    homeUrl.searchParams.delete('redirectTo')
    return NextResponse.redirect(homeUrl)
  }

  // Step 6: Enforce role-based access on protected routes.
  if (matchedPath && user) {
    const allowedRoles = PROTECTED_ROUTES[matchedPath]
    if (role && !allowedRoles.includes(role)) {
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = roleHome(role)
      return NextResponse.redirect(homeUrl)
    }
  }

  return response
}

function roleHome(role: UserRole | null): string {
  switch (role) {
    case 'doctor': return '/doctor'
    case 'admin':  return '/admin'
    default:       return '/patient'
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (Next.js static assets)
     * - _next/image   (Next.js image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt
     * - /api/webhooks (Stripe webhook — verified by signature, not session)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|api/webhooks).*)',
  ],
}
