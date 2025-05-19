/**
 * Analytics Widget Component
 *
 * A dashboard widget for displaying key metrics and analytics data.
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 * - @/hooks/use-analytics for analytics data
 */

"use client"

import { useEffect, useState } from "react"
import { FileText, Search, MessageSquare, Database, AlertCircle, Info } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useAnalytics } from "@/hooks/use-analytics"
import { useToast } from "@/components/toast"

interface AnalyticsWidgetProps {
  userId: string
}

// Maximum number of vectors per query - should match the value in analytics-service.ts
const MAX_VECTORS_PER_QUERY = 10000

export function AnalyticsWidget({ userId }: AnalyticsWidgetProps) {
  const { analytics, isLoading, error, refreshAnalytics } = useAnalytics(userId)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { addToast } = useToast()

  // Handle API errors
  useEffect(() => {
    if (error) {
      console.error("Analytics widget error:", error)
      setErrorMessage(error instanceof Error ? error.message : String(error))
      addToast("Failed to load analytics: " + (error instanceof Error ? error.message : "Unknown error"), "error")
    } else {
      setErrorMessage(null)
    }
  }, [error, addToast])

  // Retry loading analytics if there was an error
  const handleRetry = () => {
    setErrorMessage(null)
    refreshAnalytics()
  }

  // Default values if data is not available
  const metrics = {
    documentCount: analytics?.documentCount || 0,
    searchCount: analytics?.searchCount || 0,
    chatCount: analytics?.chatCount || 0,
    chunkCount: analytics?.chunkCount || 0,
  }

  // Check if any count might be truncated
  const mightBeTruncated =
    metrics.documentCount === MAX_VECTORS_PER_QUERY ||
    metrics.searchCount === MAX_VECTORS_PER_QUERY ||
    metrics.chatCount === MAX_VECTORS_PER_QUERY ||
    metrics.chunkCount === MAX_VECTORS_PER_QUERY

  return (
    <DashboardCard title="Analytics" description="Key metrics and usage statistics" isLoading={isLoading}>
      <div className="space-y-4">
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={handleRetry} className="mt-2 text-sm text-red-700 hover:text-red-900 underline">
              Retry
            </button>
          </div>
        )}

        {mightBeTruncated && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md mb-4">
            <div className="flex items-center">
              <Info className="h-5 w-5 mr-2" />
              <span>Some counts may be truncated due to large data volume.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 rounded-md bg-blue-100">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Documents</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.documentCount}
              {metrics.documentCount === MAX_VECTORS_PER_QUERY && "+"}
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 rounded-md bg-green-100">
                <Search className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Searches</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.searchCount}
              {metrics.searchCount === MAX_VECTORS_PER_QUERY && "+"}
            </p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 rounded-md bg-purple-100">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Chats</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.chatCount}
              {metrics.chatCount === MAX_VECTORS_PER_QUERY && "+"}
            </p>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 rounded-md bg-amber-100">
                <Database className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Chunks</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.chunkCount}
              {metrics.chunkCount === MAX_VECTORS_PER_QUERY && "+"}
            </p>
          </div>
        </div>
      </div>
    </DashboardCard>
  )
}
