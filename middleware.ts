import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  // For simplicity, we'll just redirect based on cookie presence
  // In a production app, you'd want to properly validate the session
  const hasSession = req.cookies.has("sb-access-token") || req.cookies.has("sb-refresh-token")

  // If no session and trying to access protected routes
  if (!hasSession && req.nextUrl.pathname !== "/login") {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = "/login"
    return NextResponse.redirect(redirectUrl)
  }

  // If session and trying to access login page
  if (hasSession && req.nextUrl.pathname === "/login") {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = "/"
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
