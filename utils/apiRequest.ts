"use client"

/**
 * API Request Utilities
 *
 * Provides utility functions for making API requests with consistent error handling.
 *
 * @module utils/apiRequest
 */

import { useAuth } from "@/hooks/use-auth"

/**
 * Handles API requests with consistent error handling
 * @param endpoint - API endpoint
 * @param options - Request options
 * @returns Response data
 */
export async function handleApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Get auth header if available
  const auth = useAuth()
  const headers = { ...options.headers } as Record<string, string>

  // If we're in a client component, we can use the auth hook
  if (typeof window !== "undefined") {
    const authHeader = await auth.getAuthHeader()
    if (authHeader) {
      headers["Authorization"] = authHeader
    }
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
    })

    if (!response.ok) {
      let errorMessage = `Request failed with status: ${response.status}`
      let errorData = null

      try {
        errorData = await response.json()
        if (errorData && errorData.error) {
          errorMessage = errorData.error
        }
      } catch (e) {
        // If we can't parse the error response, use the default message
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data.data || data
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error("An unknown error occurred")
  }
}

/**
 * Formats query parameters for URL
 * @param params - Query parameters
 * @returns Formatted query string
 */
export function formatQueryParams(params: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return ""
  }

  const queryParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item) => queryParams.append(`${key}[]`, String(item)))
      } else if (typeof value === "object" && value !== null) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue !== undefined && subValue !== null) {
            queryParams.append(`${key}[${subKey}]`, String(subValue))
          }
        })
      } else {
        queryParams.append(key, String(value))
      }
    }
  })

  return queryParams.toString()
}

/**
 * Builds a URL with query parameters
 * @param endpoint - API endpoint
 * @param params - Query parameters
 * @returns Full URL with query parameters
 */
export function buildUrl(endpoint: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return endpoint
  }

  const queryString = formatQueryParams(params)
  const separator = endpoint.includes("?") ? "&" : "?"

  return queryString ? `${endpoint}${separator}${queryString}` : endpoint
}
