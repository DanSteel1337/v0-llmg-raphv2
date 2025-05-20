/**
 * Analytics Hook
 *
 * Custom hook for fetching and managing analytics data, including
 * document counts, search metrics, and API health status.
 *
 * Dependencies:
 * - @/services/client-api-service for API calls
 * - @/components/toast for notifications
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchAnalytics, checkApiHealth } from "@/services/client-api-service"
import type { AnalyticsData, ApiHealthStatus } from "@/types"
import { useToast } from "@/components/toast"

export function useAnalytics(userId?: string) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // API health status
  const [pineconeApiHealthy, setPineconeApiHealthy] = useState<boolean | null>(null)
  const [openaiApiHealthy, setOpenaiApiHealthy] = useState<boolean | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const [healthErrors, setHealthErrors] = useState<Record<string, string | null>>({
    pinecone: null,
    openai: null,
  })

  const { addToast } = useToast()

  // Fetch analytics data
  const refreshAnalytics = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      setError(null)

      // Fetch analytics data
      const data = await fetchAnalytics(userId)
      setAnalytics(data)

      // Check API health
      await checkHealth()
    } catch (err) {
      console.error("Error fetching analytics:", err)
      const error = err instanceof Error ? err : new Error("Failed to load analytics")
      setError(error)
      addToast(`Failed to load analytics: ${error.message}`, "error")
    } finally {
      setIsLoading(false)
    }
  }, [userId, addToast])

  // Check API health
  const checkHealth = useCallback(async () => {
    try {
      setIsCheckingHealth(true)
      setPineconeApiHealthy(null)
      setOpenaiApiHealthy(null)
      setHealthErrors({
        pinecone: null,
        openai: null,
      })

      const healthStatus: ApiHealthStatus = await checkApiHealth()
      console.log("Health check results:", healthStatus)

      setPineconeApiHealthy(healthStatus.pinecone.healthy)
      setOpenaiApiHealthy(healthStatus.openai.healthy)

      setHealthErrors({
        pinecone: healthStatus.pinecone.error,
        openai: healthStatus.openai.error,
      })

      // Show toast for unhealthy APIs
      if (!healthStatus.pinecone.healthy && healthStatus.pinecone.error) {
        addToast(`Pinecone API issue: ${healthStatus.pinecone.error}`, "warning")
      }

      if (!healthStatus.openai.healthy && healthStatus.openai.error) {
        addToast(`OpenAI API issue: ${healthStatus.openai.error}`, "warning")
      }
    } catch (err) {
      console.error("Error checking API health:", err)
      const error = err instanceof Error ? err : new Error("Failed to check API health")
      addToast(`Failed to check API health: ${error.message}`, "error")
    } finally {
      setIsCheckingHealth(false)
    }
  }, [addToast])

  // Initial fetch
  useEffect(() => {
    if (userId) {
      refreshAnalytics()
    }
  }, [userId, refreshAnalytics])

  return {
    analytics,
    isLoading,
    error,
    refreshAnalytics,

    pineconeApiHealthy,
    openaiApiHealthy,
    isCheckingHealth,
    healthErrors,
    checkHealth,
  }
}
