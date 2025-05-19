"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { DocumentWidget } from "@/components/dashboard/document-widget"
import { SearchWidget } from "@/components/dashboard/search-widget"
import { ChatWidget } from "@/components/dashboard/chat-widget"
import { AnalyticsWidget } from "@/components/dashboard/analytics-widget"
import { SettingsWidget } from "@/components/dashboard/settings-widget"

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Fetch recent searches from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searches = localStorage.getItem("recentSearches")
      if (searches) {
        setRecentSearches(JSON.parse(searches))
      }
    }
  }, [])

  // If still loading or no user, show loading state
  if (isLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const userId = user.id

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Vector RAG Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your documents, search, chat, and analytics all in one place.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="py-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Documents Widget */}
            <DocumentWidget userId={userId} />

            {/* Search Widget */}
            <SearchWidget userId={userId} recentSearches={recentSearches} />

            {/* Chat Widget */}
            <ChatWidget userId={userId} />

            {/* Analytics Widget */}
            <AnalyticsWidget userId={userId} />

            {/* Settings Widget */}
            <div className="lg:col-span-2">
              <SettingsWidget userId={userId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
