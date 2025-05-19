/**
 * API Hook
 *
 * A generic hook for making API requests with loading, error, and data states.
 * Provides a consistent way to handle API calls across the application.
 *
 * Dependencies:
 * - React hooks for state management
 */

"use client"

import { useState, useCallback, useRef } from "react"

type ApiState<T> = {
  data: T | null
  isLoading: boolean
  error: Error | null
}

type ApiFunction<T, P extends any[]> = (...args: P) => Promise<T>

export function useApi<T, P extends any[]>(apiFunction: ApiFunction<T, P>) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  })

  // Use a ref to keep track of the latest apiFunction
  const apiFunctionRef = useRef(apiFunction)

  // Update the ref whenever apiFunction changes
  apiFunctionRef.current = apiFunction

  // Memoize execute with an empty dependency array since we're using the ref
  const execute = useCallback(
    async (...args: P) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      try {
        // Use the ref's current value to ensure we're using the latest function
        const data = await apiFunctionRef.current(...args)
        setState({ data, isLoading: false, error: null })
        return data
      } catch (error) {
        const errorObject = error instanceof Error ? error : new Error(String(error))
        setState({ data: null, isLoading: false, error: errorObject })
        throw errorObject
      }
    },
    [], // Empty dependency array since we're using the ref
  )

  return {
    ...state,
    execute,
  }
}
