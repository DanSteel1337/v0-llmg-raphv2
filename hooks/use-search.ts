/**
 * Search Hook
 *
 * Custom hook for managing search functionality, including performing searches,
 * managing search history, and handling search options.
 *
 * Dependencies:
 * - @/services/client-api-service for API calls
 * - @/components/toast for notifications
 */

"use client"

import { useState, useCallback, useEffect } from "react"
import { searchDocuments, getRecentSearches } from "@/services/client-api-service"
import type { SearchResult, SearchOptions } from "@/types"
import { useToast } from "@/components/toast"

// Default search options
const defaultSearchOptions: SearchOptions = {
  type: "semantic", // semantic, keyword, or hybrid
  documentTypes: [],
  sortBy: "relevance",
  dateRange: undefined,
}

export function useSearch(userId: string) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const { addToast } = useToast()

  // Fetch recent searches on mount
  useEffect(() => {
    if (userId) {
      fetchRecentSearches()
    }
  }, [userId])

  const fetchRecentSearches = useCallback(async () => {
    try {
      const searches = await getRecentSearches(userId)
      setRecentSearches(Array.isArray(searches) ? searches : [])
    } catch (err) {
      console.error("Failed to fetch recent searches:", err)
      // Don't show a toast for this non-critical error
    }
  }, [userId])

  // Perform search
  const search = useCallback(
    async (searchQuery: string, options: SearchOptions = defaultSearchOptions) => {
      if (!userId || !searchQuery.trim()) {
        return
      }

      setIsLoading(true)
      setError(null)
      setQuery(searchQuery)

      try {
        const searchResults = await searchDocuments(searchQuery, userId, options)
        setResults(searchResults)
        return searchResults
      } catch (err) {
        console.error("Search error:", err)
        const error = err instanceof Error ? err : new Error("An error occurred during search")
        setError(error)
        addToast(`Search failed: ${error.message}`, "error")
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [userId, addToast],
  )

  // Clear search results
  const clearResults = useCallback(() => {
    setResults([])
    setQuery("")
    setError(null)
  }, [])

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    if (!userId) return

    setRecentSearches([])
    if (typeof window !== "undefined") {
      localStorage.removeItem(`recentSearches-${userId}`)
    }
  }, [userId])

  return {
    query,
    results,
    isLoading,
    error,
    search,
    clearResults,
    recentSearches,
    clearRecentSearches,
  }
}
