import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!login|auth/callback|api/seed|api/webhooks|_next/static|_next/image|favicon\\.ico).*)',
  ],
}
