"use client"

/**
 * Analytics Hook
 *
 * Custom hook for fetching and managing analytics data.
 * Provides analytics metrics, API health status, and refresh functionality.
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
  const [healthErrors, setHealthErrors] = useState<{
    pinecone?: string | null
    openai?: string | null
  }>({})

  const loadAnalytics = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchAnalytics(userId)
      setAnalytics(data)
    } catch (err) {
      console.error("Error loading analytics:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const checkHealth = useCallback(async () => {
    try {
      setIsCheckingHealth(true)
      setPineconeApiHealthy(null)
      setOpenaiApiHealthy(null)

      const health = await checkApiHealth()

      // Log the health check results for debugging
      console.log("Health check results:", health)

      setPineconeApiHealthy(health.pineconeApiHealthy)
      setOpenaiApiHealthy(health.openaiApiHealthy)
      setHealthErrors(health.errors || {})

      // If there are errors, log them for debugging
      if (health.errors?.pinecone) {
        console.error("Pinecone health check error:", health.errors.pinecone)
      }
      if (health.errors?.openai) {
        console.error("OpenAI health check error:", health.errors.openai)
      }
    } catch (err) {
      console.error("Error checking API health:", err)
      setPineconeApiHealthy(false)
      setOpenaiApiHealthy(false)
    } finally {
      setIsCheckingHealth(false)
    }
  }, [])

  const refreshAnalytics = useCallback(async () => {
    await Promise.all([loadAnalytics(), checkHealth()])
  }, [loadAnalytics, checkHealth])

  useEffect(() => {
    refreshAnalytics()
  }, [refreshAnalytics])

  return {
    analytics,
    isLoading,
    error,
    refreshAnalytics,
    pineconeApiHealthy,
    openaiApiHealthy,
    isCheckingHealth,
    healthErrors,
  }
}
