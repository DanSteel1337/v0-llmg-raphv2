"use client"

import { useState, useEffect } from "react"

interface AnalyticsData {
  documentCount: number
  searchCount: number
  chatCount: number
  documentTypes: Array<{ name: string; value: number }>
  searchUsage: Array<{ date: string; count: number }>
  userActivity: Array<{ date: string; searches: number; chats: number }>
  performance: {
    search_latency: number
    indexing_speed: number
    chat_response: number
    document_processing: number
  }
}

export function useAnalytics(userId: string) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<string>("week")

  const fetchAnalytics = async (range: string = timeRange) => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/analytics?userId=${userId}&timeRange=${range}`)

      if (!response.ok) {
        throw new Error("Failed to fetch analytics")
      }

      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching analytics:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const logEvent = async (eventType: string, eventData: any) => {
    try {
      await fetch("/api/analytics", {
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
    } catch (err) {
      console.error("Error logging analytics event:", err)
    }
  }

  useEffect(() => {
    if (userId) {
      fetchAnalytics()
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
