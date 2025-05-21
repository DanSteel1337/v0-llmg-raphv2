/**
 * Search Hook
 *
 * Custom hook for performing searches and managing search results.
 * Provides functionality for semantic, keyword, and hybrid search,
 * as well as tracking recent searches.
 *
 * Features:
 * - Multiple search types (semantic, keyword, hybrid)
 * - Automatic recent search tracking
 * - Configurable search options
 * - Debounced search capability
 * - Error handling and loading states
 * 
 * Dependencies:
 * - @/hooks/use-api for API interaction
 * - @/services/client-api-service for search API
 * - @/types for search and result types
 *
 * @module hooks/use-search
 */

"use client"

import { useState, useCallback, useEffect } from "react"
import { useApi } from "@/hooks/use-api"
import { performSearch } from "@/services/client-api-service"
import type { SearchResult, SearchOptions } from "@/types"

/**
 * Hook for search functionality
 * @param userId User ID for the current user
 * @returns Search state and methods
 */
export function useSearch(userId: string) {
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    type: "semantic",
  })
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Wrap the search function with useCallback
  const searchCallback = useCallback(
    (query: string) => {
      return performSearch(userId, query, searchOptions)
    },
    [userId, searchOptions],
  )

  const { data: results, isLoading, error, execute: executeSearch } = useApi<SearchResult[], [string]>(searchCallback)

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  /**
   * Save search to local storage
   * @param query Search query to save
   */
  const saveSearchToHistory = (query: string) => {
    if (typeof window !== "undefined") {
      const searches = getRecentSearches()
      if (!searches.includes(query)) {
        searches.unshift(query)
        if (searches.length > 5) searches.pop()
        localStorage.setItem("recentSearches", JSON.stringify(searches))
        setRecentSearches(searches)
      }
    }
  }

  /**
   * Perform a search
   * @param query Search query
   * @returns Search results
   */
  const search = async (query: string) => {
    if (!query || typeof query !== "string") {
      throw new Error("Search query cannot be empty")
    }

    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return []
    }

    if (trimmedQuery.length < 2) {
      throw new Error("Search query must be at least 2 characters")
    }

    try {
      const results = await executeSearch(trimmedQuery)
      saveSearchToHistory(trimmedQuery)
      return results
    } catch (error) {
      console.error("Search error:", error)
      throw error
    }
  }

  /**
   * Get recent searches from local storage
   * @returns Array of recent search queries
   */
  const getRecentSearches = (): string[] => {
    if (typeof window === "undefined") return []

    try {
      const searches = JSON.parse(localStorage.getItem("recentSearches") || "[]")
      return Array.isArray(searches) ? searches : []
    } catch (error) {
      console.error("Error parsing recent searches:", error)
      return []
    }
  }

  return {
    results: results || [],
    isLoading,
    error,
    search,
    setSearchOptions,
    searchOptions,
    recentSearches,
  }
}
