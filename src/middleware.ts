import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicRoutes = ['/login', '/register', '/forgot-password']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // If trying to access public routes, allow it
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // For all other routes, let the client-side handle authentication
  return NextResponse.next()
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
