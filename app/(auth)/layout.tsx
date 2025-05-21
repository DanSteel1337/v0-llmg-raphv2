"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "@/hooks/use-auth"

/**
 * Auth Layout with AuthProvider
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">{children}</div>
    </AuthProvider>
  )
}
