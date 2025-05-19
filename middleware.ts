import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

// Fix: Change from "edge" to "experimental-edge" for middleware
export const runtime = "experimental-edge"

// Supabase middleware requires a separate client instance (createMiddlewareClient)
// This is the only file allowed to bypass the singleton client pattern
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protected routes
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard") || req.nextUrl.pathname.startsWith("/api")

  // Public routes
  const isPublicRoute = req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/signup"

  // If accessing a protected route without a session, redirect to login
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL("/login", req.url)
    return NextResponse.redirect(redirectUrl)
  }

  // If accessing login/signup with a session, redirect to dashboard
  if (isPublicRoute && session) {
    const redirectUrl = new URL("/dashboard", req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

// Specify which routes this middleware should run on
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
