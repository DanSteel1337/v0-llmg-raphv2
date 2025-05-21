/**
 * Dashboard Layout
 *
 * The layout component for the dashboard section of the application.
 * Provides the common layout structure for all dashboard pages.
 */

import type { ReactNode } from "react"
import { Navigation } from "@/components/navigation"
import { AuthProvider } from "@/hooks/use-auth"
import { ToastProvider } from "@/components/toast"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex h-screen bg-gray-100">
          <Navigation />
          <div className="flex-1 overflow-auto">
            <main>{children}</main>
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}
