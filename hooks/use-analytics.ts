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
import { fetchAnalytics, checkApiHealth } from "@/services/client-api-service"
import type { AnalyticsData } from "@/types"

export function useAnalytics(userId: string) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pineconeApiHealthy, setPineconeApiHealthy] = useState<boolean | null>(null)
  const [openaiApiHealthy, setOpenaiApiHealthy] = useState<boolean | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)

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

  const checkHealth = useCallback(async () => {
    try {
      setIsCheckingHealth(true)
      const health = await checkApiHealth()
      setPineconeApiHealthy(health.pineconeApiHealthy)
      setOpenaiApiHealthy(health.openaiApiHealthy)
    } catch (err) {
      console.error("Error checking API health:", err)
      setPineconeApiHealthy(false)
      setOpenaiApiHealthy(false)
    } finally {
      setIsCheckingHealth(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    checkHealth()

    // Set up a health check interval (every 5 minutes)
    const healthInterval = setInterval(checkHealth, 5 * 60 * 1000)

    return () => {
      clearInterval(healthInterval)
    }
  }, [fetchData, checkHealth])

  const refreshAnalytics = useCallback(() => {
    fetchData()
    checkHealth()
  }, [fetchData, checkHealth])

  return {
    analytics,
    isLoading,
    error,
    refreshAnalytics,
    pineconeApiHealthy,
    openaiApiHealthy,
    isCheckingHealth,
  }
}
