/**
 * Search Hook
 *
 * Custom hook for performing searches and managing search results.
 *
 * Dependencies:
 * - @/hooks/use-api for API interaction
 * - @/types for search types
 */

"use client"

import { useState, useCallback } from "react"
import { useApi } from "@/hooks/use-api"
import { performSearch } from "@/services/client-api-service"
import type { SearchResult, SearchOptions } from "@/types"

export function useSearch(userId: string) {
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    type: "semantic",
  })

  // Wrap the search function with useCallback
  const searchCallback = useCallback(
    (query: string) => {
      return performSearch(userId, query, searchOptions)
    },
    [userId, searchOptions],
  )

  const { data: results, isLoading, error, execute: executeSearch } = useApi<SearchResult[], [string]>(searchCallback)

  // Save search to local storage
  const saveSearchToHistory = (query: string) => {
    if (typeof window !== "undefined") {
      const searches = JSON.parse(localStorage.getItem("recentSearches") || "[]")
      if (!searches.includes(query)) {
        searches.unshift(query)
        if (searches.length > 5) searches.pop()
        localStorage.setItem("recentSearches", JSON.stringify(searches))
      }
    }
  }

  const search = async (query: string) => {
    if (!query.trim()) return []

    try {
      const results = await executeSearch(query)
      saveSearchToHistory(query)
      return results
    } catch (error) {
      console.error("Search error:", error)
      throw error
    }
  }

  return {
    results: results || [],
    isLoading,
    error,
    search,
    setSearchOptions,
    searchOptions,
  }
}
