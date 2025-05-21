/**
 * Analytics Hook
 *
 * Custom hook for fetching and managing analytics data.
 * Provides functionality for retrieving analytics metrics,
 * checking API health status, and refresh capabilities.
 *
 * Features:
 * - Analytics data retrieval (documents, searches, chats)
 * - API health monitoring
 * - Automatic refresh on mount
 * - Manual refresh capability
 * - Error handling and loading states
 * 
 * Dependencies:
 * - @/services/client-api-service for API calls
 * - @/types for analytics data types
 * 
 * @module hooks/use-analytics
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchAnalytics, checkApiHealth } from "@/services/client-api-service"
import type { AnalyticsData } from "@/types"

/**
 * Hook for analytics functionality
 * @param userId User ID for the current user
 * @returns Analytics state and methods
 */
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

  /**
   * Load analytics data
   */
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

  /**
   * Check health of backend services
   */
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

  /**
   * Refresh analytics data and check API health
   */
  const refreshAnalytics = useCallback(async () => {
    await Promise.all([loadAnalytics(), checkHealth()])
  }, [loadAnalytics, checkHealth])

  // Initial load on mount
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
