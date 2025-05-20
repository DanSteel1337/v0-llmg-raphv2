/**
 * Search Hook
 *
 * Custom hook for performing searches and managing search results.
 * Provides functionality for executing searches with various options
 * and handling the search lifecycle.
 *
 * Features:
 * - Semantic and keyword search capabilities
 * - Search history tracking
 * - Result filtering and sorting
 * - Loading state management
 * - Error handling
 *
 * Dependencies:
 * - @/services/client-api-service for backend communication
 * - @/types for search result type definitions
 *
 * @module hooks/use-search
 */

"use client"

import { useState, useCallback } from "react"
import { performSearch as apiPerformSearch } from "@/services/client-api-service"
import type { SearchResult, SearchOptions } from "@/types"
import { useToastAdapter } from "@/components/toast-adapter"

/**
 * Hook for search functionality
 * @param userId User ID for the current user
 * @returns Search state and methods
 */
export function useSearch(userId: string) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const { toast } = useToastAdapter()

  /**
   * Perform a search with the given query and options
   * @param query Search query
   * @param options Search options
   * @returns Search results
   */
  const performSearch = useCallback(
    async (query: string, options: SearchOptions = { type: "semantic" }) => {
      if (!query.trim()) {
        setResults([])
        return []
      }

      if (!userId) {
        setError("User ID is required to perform a search")
        toast("User ID is required to perform a search", "error")
        return []
      }

      try {
        setIsLoading(true)
        setError(null)

        const searchResults = await apiPerformSearch(userId, query, options)

        // Update search history
        setSearchHistory((prev) => {
          const newHistory = [query, ...prev.filter((q) => q !== query)]
          return newHistory.slice(0, 10) // Keep only the 10 most recent searches
        })

        setResults(searchResults)
        return searchResults
      } catch (err) {
        console.error("Error performing search:", err)
        const errorMessage = err instanceof Error ? err.message : "An error occurred during search"
        setError(errorMessage)
        toast("Search failed: " + errorMessage, "error")
        return []
      } finally {
        setIsLoading(false)
      }
    },
    [userId, toast],
  )

  /**
   * Clear search results and history
   */
  const clearSearch = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return {
    results,
    isLoading,
    error,
    searchHistory,
    performSearch,
    clearSearch,
  }
}
