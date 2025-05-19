/**
 * Auth Layout
 *
 * The layout component for the authentication section of the application.
 * Provides the common layout structure for login and signup pages.
 *
 * Dependencies:
 * - None
 */

import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-gray-50">{children}</div>
}
