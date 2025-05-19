"use client"

/**
 * Analytics Hook
 *
 * Custom hook for fetching and managing analytics data.
 *
 * Dependencies:
 * - @/services/client-api-service for API calls
 */

import { useState, useEffect, useCallback } from "react"
import { fetchAnalytics } from "@/services/client-api-service"
import type { AnalyticsData } from "@/types"

export function useAnalytics(userId: string) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchAnalytics(userId)
      setAnalytics(data)
    } catch (err) {
      console.error("Error fetching analytics:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refreshAnalytics = useCallback(() => {
    fetchData()
  }, [fetchData])

  return {
    analytics,
    isLoading,
    error,
    refreshAnalytics,
  }
}
