/**
 * Search Hook
 *
 * React hook for performing vector searches.
 * Provides functionality for searching documents and managing search results.
 *
 * Dependencies:
 * - @/services/client-api-service for API interactions
 * - @/types for search types
 */

"use client"

import { useState, useCallback } from "react"
import { useAuth } from "./use-auth"
import { performSearch } from "@/services/client-api-service"
import type { SearchResult, SearchOptions } from "@/types"

export function useSearch() {
  const { user } = useAuth()
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState<string>("")

  // Perform a search
  const search = useCallback(
    async (query: string, options?: SearchOptions) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      if (!query.trim()) {
        setResults([])
        setLastQuery("")
        return []
      }

      try {
        setIsSearching(true)
        setError(null)
        setLastQuery(query)

        const searchResults = await performSearch(user.id, query, options)
        setResults(searchResults)
        return searchResults
      } catch (err) {
        console.error("Error performing search:", err)
        setError(err instanceof Error ? err.message : "Search failed")
        return []
      } finally {
        setIsSearching(false)
      }
    },
    [user?.id],
  )

  // Clear search results
  const clearResults = useCallback(() => {
    setResults([])
    setLastQuery("")
    setError(null)
  }, [])

  return {
    results,
    isSearching,
    error,
    lastQuery,
    search,
    clearResults,
  }
}
