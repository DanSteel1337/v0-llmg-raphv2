import type React from "react"
// app/(dashboard)/layout.tsx
import { ToastProvider } from "@/components/toast"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <ToastProvider>
        <main className="container mx-auto py-6 px-4">{children}</main>
      </ToastProvider>
    </div>
  )
}
