// Auth middleware is temporarily disabled while login/register pages are built.
// Re-enable role-based route guards once Supabase Auth sessions are wired up.
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  void request
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
