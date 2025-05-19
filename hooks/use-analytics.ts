/**
 * Analytics Hook
 *
 * Custom hook for fetching analytics data from the API.
 *
 * Dependencies:
 * - @/hooks/use-api for API interaction
 * - @/types for analytics data types
 */

"use client"

import { useEffect } from "react"
import { useApi } from "@/hooks/use-api"
import type { AnalyticsData } from "@/types"

export function useAnalytics(userId: string) {
  const {
    data,
    isLoading,
    error,
    execute: fetchAnalytics,
  } = useApi<AnalyticsData, []>(async () => {
    const response = await fetch(`/api/analytics?userId=${userId}`)

    if (!response.ok) {
      throw new Error("Failed to fetch analytics")
    }

    const { data } = await response.json()
    return data
  })

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return {
    analytics: data,
    isLoading,
    error,
    refreshAnalytics: fetchAnalytics,
  }
}
