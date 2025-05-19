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

import { FileText, Search, MessageSquare } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useAnalytics } from "@/hooks/use-analytics"

interface AnalyticsWidgetProps {
  userId: string
}

export function AnalyticsWidget({ userId }: AnalyticsWidgetProps) {
  const { analytics, isLoading } = useAnalytics(userId)

  // Default values if data is not available
  const metrics = {
    documentCount: analytics?.documentCount || 0,
    searchCount: analytics?.searchCount || 0,
    chatCount: analytics?.chatCount || 0,
  }

  return (
    <DashboardCard title="Analytics" description="Key metrics and usage statistics" isLoading={isLoading}>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 rounded-md bg-blue-100">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-gray-500">Documents</p>
          <p className="text-2xl font-semibold text-gray-900">{metrics.documentCount}</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 rounded-md bg-green-100">
              <Search className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-gray-500">Searches</p>
          <p className="text-2xl font-semibold text-gray-900">{metrics.searchCount}</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 rounded-md bg-purple-100">
              <MessageSquare className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-gray-500">Chats</p>
          <p className="text-2xl font-semibold text-gray-900">{metrics.chatCount}</p>
        </div>
      </div>
    </DashboardCard>
  )
}
