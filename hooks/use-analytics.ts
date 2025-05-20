/**
 * Analytics Hook
 *
 * React hook for fetching and managing analytics data.
 * Provides functionality for retrieving usage statistics and insights.
 *
 * Dependencies:
 * - @/services/client-api-service for API interactions
 * - @/types for analytics types
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./use-auth"
import { fetchAnalytics } from "@/services/client-api-service"
import type { AnalyticsData } from "@/types"

export function useAnalytics() {
  const { user } = useAuth()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<string>("all")

  // Fetch analytics data on mount, when user changes, or when timeframe changes
  useEffect(() => {
    if (!user?.id) {
      setAnalyticsData(null)
      return
    }

    const loadAnalytics = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchAnalytics(user.id, timeframe)
        setAnalyticsData(data)
      } catch (err) {
        console.error("Error fetching analytics:", err)
        setError(err instanceof Error ? err.message : "Failed to load analytics")
      } finally {
        setIsLoading(false)
      }
    }

    loadAnalytics()
  }, [user?.id, timeframe])

  // Refresh analytics data
  const refreshAnalytics = useCallback(async () => {
    if (!user?.id) {
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchAnalytics(user.id, timeframe)
      setAnalyticsData(data)
    } catch (err) {
      console.error("Error refreshing analytics:", err)
      setError(err instanceof Error ? err.message : "Failed to refresh analytics")
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, timeframe])

  // Change timeframe
  const changeTimeframe = useCallback((newTimeframe: string) => {
    setTimeframe(newTimeframe)
  }, [])

  return {
    analyticsData,
    isLoading,
    error,
    timeframe,
    refreshAnalytics,
    changeTimeframe,
  }
}
