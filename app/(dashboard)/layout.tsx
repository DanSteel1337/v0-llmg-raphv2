import type React from "react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto py-6 px-4">{children}</main>
    </div>
  )
}
