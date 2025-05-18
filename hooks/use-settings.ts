"use client"

import { useState, useEffect } from "react"

interface Setting {
  key: string
  value: any
  description?: string
}

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/settings")

      if (!response.ok) {
        throw new Error("Failed to fetch settings")
      }

      const data = await response.json()
      setSettings(data.settings)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching settings:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const updateSetting = async (key: string, value: any, description?: string) => {
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key,
          value,
          description,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update setting")
      }

      const data = await response.json()

      // Update the settings state
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }))

      return data.setting
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error updating setting:", err)
      throw err
    }
  }

  const validateSettings = async () => {
    try {
      const response = await fetch("/api/settings/validate")

      if (!response.ok) {
        throw new Error("Settings validation failed")
      }

      const data = await response.json()
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error validating settings:", err)
      throw err
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSetting,
    validateSettings,
  }
}
