/**
 * Configuration Hook
 *
 * Custom hook for accessing server configuration safely from client components.
 */

"use client"

import { useState, useEffect } from "react"
import { CLIENT_CONFIG } from "@/lib/client-config"

interface ServerConfig {
  embedding: {
    model: string
    dimensions: number
    hostAvailable: boolean
    indexName: string
  }
  features: {
    search: boolean
    chat: boolean
    analytics: boolean
    documentUpload: boolean
  }
}

export function useConfig() {
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchConfig() {
      try {
        setIsLoading(true)
        const response = await fetch("/api/config")

        if (!response.ok) {
          throw new Error(`Failed to fetch configuration: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        setServerConfig(data)
      } catch (err) {
        console.error("Error fetching configuration:", err)
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsLoading(false)
      }
    }

    fetchConfig()
  }, [])

  // Combine client and server config
  const config = {
    // Always available client config
    ...CLIENT_CONFIG,

    // Server config (if available)
    server: serverConfig,

    // Status
    isLoading,
    error,

    // Helper to check if server config is available
    isServerConfigAvailable: !!serverConfig && !error,
  }

  return config
}
