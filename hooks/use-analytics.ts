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

import { useEffect, useCallback } from "react"
import { useApi } from "@/hooks/use-api"
import { fetchAnalytics } from "@/services/client-api-service"
import type { AnalyticsData } from "@/types"

export function useAnalytics(userId: string) {
  // Wrap the fetchAnalytics call with useCallback
  const fetchAnalyticsCallback = useCallback(() => {
    return fetchAnalytics(userId)
  }, [userId])

  const { data, isLoading, error, execute: loadAnalytics } = useApi<AnalyticsData, []>(fetchAnalyticsCallback)

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  return {
    analytics: data,
    isLoading,
    error,
    refreshAnalytics: loadAnalytics,
  }
}
