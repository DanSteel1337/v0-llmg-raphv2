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

import { useState } from "react"
import { useApi } from "@/hooks/use-api"
import type { SearchResult, SearchOptions } from "@/types"

export function useSearch(userId: string) {
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    type: "semantic",
  })

  const {
    data: results,
    isLoading,
    error,
    execute: performSearch,
  } = useApi<SearchResult[], [string]>(async (query) => {
    // Build query parameters
    const params = new URLSearchParams({
      userId,
      q: query,
      type: searchOptions.type,
    })

    // Add document types if provided
    if (searchOptions.documentTypes && searchOptions.documentTypes.length > 0) {
      searchOptions.documentTypes.forEach((type) => {
        params.append("documentType", type)
      })
    }

    // Add sort option if provided
    if (searchOptions.sortBy) {
      params.append("sortBy", searchOptions.sortBy)
    }

    // Add date range if provided
    if (searchOptions.dateRange?.from) {
      params.append("from", searchOptions.dateRange.from.toISOString())
    }
    if (searchOptions.dateRange?.to) {
      params.append("to", searchOptions.dateRange.to.toISOString())
    }

    const response = await fetch(`/api/search?${params.toString()}`)

    if (!response.ok) {
      throw new Error("Failed to perform search")
    }

    const { data } = await response.json()
    return data.results || []
  })

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
      const results = await performSearch(query)
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
