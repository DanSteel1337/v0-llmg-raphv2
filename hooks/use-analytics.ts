// Info: This hook implements analytics using API routes that use Pinecone for storage
"use client"

import { useState, useEffect } from "react"

interface DocumentType {
  name: string
  value: number
}

interface SearchUsage {
  date: string
  count: number
}

interface UserActivity {
  date: string
  searches: number
  chats: number
}

interface Performance {
  search_latency: number
  indexing_speed: number
  chat_response: number
  document_processing: number
}

interface AnalyticsData {
  documentCount: number
  searchCount: number
  chatCount: number
  documentTypes: DocumentType[]
  searchUsage: SearchUsage[]
  userActivity: UserActivity[]
  performance: Performance
}

export function useAnalytics(userId: string) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<string>("week")

  // Replace the fetchAnalytics function with this improved version:
  const fetchAnalytics = async (range: string = timeRange) => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/analytics?userId=${userId}&timeRange=${range}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status} ${response.statusText}`)
      }

      const analyticsData = await response.json()

      // Validate the response data to ensure it has the expected structure
      if (!analyticsData) {
        throw new Error("Received empty analytics data")
      }

      // Set default values for any missing properties
      const validatedData: AnalyticsData = {
        documentCount: analyticsData.documentCount || 0,
        searchCount: analyticsData.searchCount || 0,
        chatCount: analyticsData.chatCount || 0,
        documentTypes: Array.isArray(analyticsData.documentTypes) ? analyticsData.documentTypes : [],
        searchUsage: Array.isArray(analyticsData.searchUsage) ? analyticsData.searchUsage : [],
        userActivity: Array.isArray(analyticsData.userActivity) ? analyticsData.userActivity : [],
        performance: analyticsData.performance || {
          search_latency: 0,
          indexing_speed: 0,
          chat_response: 0,
          document_processing: 0,
        },
      }

      setData(validatedData)
      return validatedData
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred"
      console.error("Error fetching analytics:", err)
      setError(errorMessage)

      // Return default data structure on error
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const logEvent = async (eventType: string, eventData: any) => {
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventType,
          eventData,
          userId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to log analytics event")
      }

      await response.json()
    } catch (err) {
      console.error("Error logging analytics event:", err)
    }
  }

  useEffect(() => {
    if (userId) {
      fetchAnalytics(timeRange)
    }
  }, [userId, timeRange])

  return {
    data,
    isLoading,
    error,
    timeRange,
    setTimeRange,
    fetchAnalytics,
    logEvent,
  }
}
