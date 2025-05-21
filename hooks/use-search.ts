/**
 * Search Hooks
 *
 * A collection of React hooks for search functionality in the RAG system.
 * Provides semantic search, filtering, and result management for documents and content.
 *
 * Features:
 * - Semantic, keyword, and hybrid search capabilities
 * - Advanced filtering and sorting options
 * - Search history tracking and suggestions
 * - Debounced inputs and request cancellation
 * - Caching and background revalidation
 * - Comprehensive error handling
 *
 * @module hooks/use-search
 */

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useDebounce } from "use-debounce"
import type { SearchOptions, SearchResult } from "@/types"

// Constants
const SEARCH_CACHE_TIME = 1000 * 60 * 5 // 5 minutes
const SEARCH_STALE_TIME = 1000 * 60 * 1 // 1 minute
const SEARCH_HISTORY_KEY = "search_history"
const SEARCH_HISTORY_MAX_ITEMS = 10
const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

// Types
export type SearchMode = "semantic" | "keyword" | "hybrid"
export type SortOption = "relevance" | "date" | "title"
export type SortDirection = "asc" | "desc"

export interface SearchFilter {
  documentTypes?: string[]
  dateRange?: {
    from?: Date
    to?: Date
  }
  tags?: string[]
  status?: string[]
  userId?: string
}

export interface SearchParams {
  query: string
  mode?: SearchMode
  filter?: SearchFilter
  sort?: {
    field: SortOption
    direction: SortDirection
  }
  page?: number
  pageSize?: number
  includeHighlights?: boolean
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  query: string
  suggestions?: string[]
  didYouMean?: string
  timeTaken?: number
}

export interface SearchState {
  results: SearchResult[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  suggestions?: string[]
  didYouMean?: string
  timeTaken?: number
}

export interface SearchHistoryItem {
  query: string
  timestamp: number
  count: number
  lastResults?: number
}

/**
 * Performs a search request to the API
 *
 * @param params - Search parameters
 * @returns Promise with search response
 */
async function performSearch(params: SearchParams): Promise<SearchResponse> {
  const { query, mode = "semantic", filter, sort, page = 1, pageSize = 10, includeHighlights = true } = params

  if (!query || query.length < MIN_QUERY_LENGTH) {
    return {
      results: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      query,
    }
  }

  // Create URL with query parameters
  const searchParams = new URLSearchParams()
  searchParams.append("query", query)
  searchParams.append("mode", mode)
  searchParams.append("page", page.toString())
  searchParams.append("pageSize", pageSize.toString())
  searchParams.append("includeHighlights", includeHighlights.toString())

  if (sort) {
    searchParams.append("sortField", sort.field)
    searchParams.append("sortDirection", sort.direction)
  }

  // Build request body for filters
  const requestBody: Record<string, any> = { filter: {} }

  if (filter) {
    if (filter.documentTypes && filter.documentTypes.length > 0) {
      requestBody.filter.documentTypes = filter.documentTypes
    }

    if (filter.tags && filter.tags.length > 0) {
      requestBody.filter.tags = filter.tags
    }

    if (filter.status && filter.status.length > 0) {
      requestBody.filter.status = filter.status
    }

    if (filter.userId) {
      requestBody.filter.userId = filter.userId
    }

    if (filter.dateRange) {
      if (filter.dateRange.from) {
        requestBody.filter.dateFrom = filter.dateRange.from.toISOString()
      }
      if (filter.dateRange.to) {
        requestBody.filter.dateTo = filter.dateRange.to.toISOString()
      }
    }
  }

  // Create abort controller for cancellation
  const controller = new AbortController()
  const signal = controller.signal

  try {
    const response = await fetch(`/api/search?${searchParams.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(errorData?.error || `Search failed with status: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Search failed")
    }

    return data.data
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      // Request was cancelled, return empty results
      return {
        results: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        query,
      }
    }
    throw error
  }
}

/**
 * Core search hook that provides search functionality with filtering and pagination
 *
 * @param userId - User ID for the current user
 * @returns Search state and functions
 */
export function useSearch(userId: string) {
  // State
  const [searchParams, setSearchParams] = useState<SearchParams>({
    query: "",
    mode: "semantic",
    page: 1,
    pageSize: 10,
    filter: { userId },
  })
  const [debouncedQuery] = useDebounce(searchParams.query, DEBOUNCE_MS)
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    type: "semantic",
  })
  const abortControllerRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()

  // Create a stable search key for React Query
  const searchKey = useMemo(() => {
    return [
      "search",
      debouncedQuery,
      searchParams.mode,
      searchParams.page,
      searchParams.pageSize,
      JSON.stringify(searchParams.filter),
      JSON.stringify(searchParams.sort),
    ]
  }, [
    debouncedQuery,
    searchParams.mode,
    searchParams.page,
    searchParams.pageSize,
    searchParams.filter,
    searchParams.sort,
  ])

  // Search query with React Query
  const { data, isLoading, isError, error, refetch } = useQuery<SearchResponse, Error>({
    queryKey: searchKey,
    queryFn: () => {
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create a new abort controller
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      // Update search options to match current params
      const currentMode = searchParams.mode || "semantic"
      if (searchOptions.type !== currentMode) {
        setSearchOptions({ ...searchOptions, type: currentMode as "semantic" | "keyword" | "hybrid" })
      }

      // Perform the search with the current params
      return performSearch({
        ...searchParams,
        query: debouncedQuery,
      })
    },
    enabled: debouncedQuery.length >= MIN_QUERY_LENGTH,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_CACHE_TIME,
    retry: (failureCount, error) => {
      // Don't retry if it's a 4xx error
      if (error.message.includes("status: 4")) {
        return false
      }
      return failureCount < 2
    },
  })

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Update search history when search is successful
  useEffect(() => {
    if (data && debouncedQuery && data.results.length > 0) {
      saveSearchToHistory(debouncedQuery, data.results.length)
    }
  }, [data, debouncedQuery])

  // Search function
  const search = useCallback(
    async (query: string) => {
      if (!query || typeof query !== "string") {
        throw new Error("Search query cannot be empty")
      }

      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        return []
      }

      if (trimmedQuery.length < MIN_QUERY_LENGTH) {
        throw new Error(`Search query must be at least ${MIN_QUERY_LENGTH} characters`)
      }

      // Update search params with the new query
      setSearchParams((prev) => ({
        ...prev,
        query: trimmedQuery,
        page: 1, // Reset to first page on new search
      }))

      // If the query is already debounced (same as current), trigger refetch
      if (trimmedQuery === debouncedQuery) {
        try {
          const result = await refetch()
          return result.data?.results || []
        } catch (error) {
          console.error("Search error:", error)
          throw error
        }
      }

      // Otherwise, the debounce effect will trigger the search
      return []
    },
    [debouncedQuery, refetch],
  )

  // Update search options
  const updateSearchOptions = useCallback((options: Partial<SearchParams>) => {
    setSearchParams((prev) => ({
      ...prev,
      ...options,
      // Reset to page 1 if anything other than page changes
      page:
        options.page !== undefined
          ? options.page
          : options.query !== undefined ||
              options.mode !== undefined ||
              options.filter !== undefined ||
              options.sort !== undefined
            ? 1
            : prev.page,
    }))
  }, [])

  // Save search to history
  const saveSearchToHistory = useCallback((query: string, resultCount: number) => {
    if (typeof window === "undefined" || !query.trim()) return

    try {
      const searches = getRecentSearches()
      const existingIndex = searches.findIndex((s) => s.query.toLowerCase() === query.toLowerCase())

      if (existingIndex >= 0) {
        // Update existing search
        searches[existingIndex] = {
          ...searches[existingIndex],
          timestamp: Date.now(),
          count: searches[existingIndex].count + 1,
          lastResults: resultCount,
        }
      } else {
        // Add new search
        searches.unshift({
          query,
          timestamp: Date.now(),
          count: 1,
          lastResults: resultCount,
        })

        // Limit the number of items
        if (searches.length > SEARCH_HISTORY_MAX_ITEMS) {
          searches.pop()
        }
      }

      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searches))
    } catch (error) {
      console.error("Error saving search to history:", error)
    }
  }, [])

  // Get recent searches from local storage
  const getRecentSearches = useCallback((): SearchHistoryItem[] => {
    if (typeof window === "undefined") return []

    try {
      const searches = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]")
      return Array.isArray(searches) ? searches : []
    } catch (error) {
      console.error("Error parsing recent searches:", error)
      return []
    }
  }, [])

  // Clear search history
  const clearSearchHistory = useCallback(() => {
    if (typeof window === "undefined") return

    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY)
    } catch (error) {
      console.error("Error clearing search history:", error)
    }
  }, [])

  // Invalidate search cache
  const invalidateSearchCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["search"] })
  }, [queryClient])

  // Prepare the search state
  const searchState: SearchState = {
    results: data?.results || [],
    isLoading,
    isError,
    error: error || null,
    pagination: {
      page: data?.page || searchParams.page || 1,
      pageSize: data?.pageSize || searchParams.pageSize || 10,
      total: data?.total || 0,
      totalPages: data?.totalPages || 0,
    },
    suggestions: data?.suggestions,
    didYouMean: data?.didYouMean,
    timeTaken: data?.timeTaken,
  }

  // Return the search state and functions
  return {
    ...searchState,
    search,
    setSearchOptions: updateSearchOptions,
    searchOptions,
    recentSearches: getRecentSearches().map((item) => item.query),
    clearSearchHistory,
    invalidateSearchCache,
    pagination: searchState.pagination,
  }
}

/**
 * Hook for managing search filters
 *
 * @returns Filter state and functions
 */
export function useSearchFilters() {
  // State
  const [filters, setFilters] = useState<SearchFilter>({
    documentTypes: [],
    dateRange: {},
    tags: [],
    status: [],
  })

  // Add or remove document type filter
  const toggleDocumentType = useCallback((type: string) => {
    setFilters((prev) => {
      const types = prev.documentTypes || []
      if (types.includes(type)) {
        return { ...prev, documentTypes: types.filter((t) => t !== type) }
      } else {
        return { ...prev, documentTypes: [...types, type] }
      }
    })
  }, [])

  // Set date range filter
  const setDateRange = useCallback((from?: Date, to?: Date) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { from, to },
    }))
  }, [])

  // Add or remove tag filter
  const toggleTag = useCallback((tag: string) => {
    setFilters((prev) => {
      const tags = prev.tags || []
      if (tags.includes(tag)) {
        return { ...prev, tags: tags.filter((t) => t !== tag) }
      } else {
        return { ...prev, tags: [...tags, tag] }
      }
    })
  }, [])

  // Add or remove status filter
  const toggleStatus = useCallback((status: string) => {
    setFilters((prev) => {
      const statuses = prev.status || []
      if (statuses.includes(status)) {
        return { ...prev, status: statuses.filter((s) => s !== status) }
      } else {
        return { ...prev, status: [...statuses, status] }
      }
    })
  }, [])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters({
      documentTypes: [],
      dateRange: {},
      tags: [],
      status: [],
    })
  }, [])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      (filters.documentTypes && filters.documentTypes.length > 0) ||
      (filters.tags && filters.tags.length > 0) ||
      (filters.status && filters.status.length > 0) ||
      !!filters.dateRange?.from ||
      !!filters.dateRange?.to
    )
  }, [filters])

  return {
    filters,
    setFilters,
    toggleDocumentType,
    setDateRange,
    toggleTag,
    toggleStatus,
    resetFilters,
    hasActiveFilters,
  }
}

/**
 * Hook for tracking and suggesting search history
 *
 * @returns Search history state and functions
 */
export function useSearchHistory() {
  // State
  const [history, setHistory] = useState<SearchHistoryItem[]>([])

  // Load search history on mount
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const searches = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]")
      setHistory(Array.isArray(searches) ? searches : [])
    } catch (error) {
      console.error("Error loading search history:", error)
      setHistory([])
    }
  }, [])

  // Get search suggestions based on input
  const getSuggestions = useCallback(
    (input: string, limit = 5): string[] => {
      if (!input || input.length < 2) return []

      const lowerInput = input.toLowerCase()
      return history
        .filter((item) => item.query.toLowerCase().includes(lowerInput))
        .sort((a, b) => b.count - a.count) // Sort by frequency
        .slice(0, limit)
        .map((item) => item.query)
    },
    [history],
  )

  // Clear search history
  const clearHistory = useCallback(() => {
    if (typeof window === "undefined") return

    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY)
      setHistory([])
    } catch (error) {
      console.error("Error clearing search history:", error)
    }
  }, [])

  // Remove a specific search from history
  const removeFromHistory = useCallback(
    (query: string) => {
      if (typeof window === "undefined") return

      try {
        const newHistory = history.filter((item) => item.query !== query)
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory))
        setHistory(newHistory)
      } catch (error) {
        console.error("Error removing search from history:", error)
      }
    },
    [history],
  )

  return {
    history,
    getSuggestions,
    clearHistory,
    removeFromHistory,
    recentSearches: history.slice(0, 5).map((item) => item.query),
  }
}

/**
 * Hook for semantic vector search
 *
 * @param userId - User ID for the current user
 * @returns Semantic search state and functions
 */
export function useSimilaritySearch(userId: string) {
  // Use the core search hook with semantic mode
  const searchHook = useSearch(userId)

  // Perform semantic search
  const search = useCallback(
    async (query: string, options?: Partial<SearchParams>) => {
      // Update search options to use semantic mode
      searchHook.setSearchOptions({
        ...options,
        mode: "semantic",
      })

      return searchHook.search(query)
    },
    [searchHook],
  )

  return {
    ...searchHook,
    search,
  }
}

/**
 * Hook for hybrid search (combining keyword and vector search)
 *
 * @param userId - User ID for the current user
 * @returns Hybrid search state and functions
 */
export function useHybridSearch(userId: string) {
  // Use the core search hook with hybrid mode
  const searchHook = useSearch(userId)

  // Perform hybrid search
  const search = useCallback(
    async (query: string, options?: Partial<SearchParams>) => {
      // Update search options to use hybrid mode
      searchHook.setSearchOptions({
        ...options,
        mode: "hybrid",
      })

      return searchHook.search(query)
    },
    [searchHook],
  )

  return {
    ...searchHook,
    search,
  }
}

/**
 * Hook for finding similar documents to a given document
 *
 * @param userId - User ID for the current user
 * @returns Similar documents search function and state
 */
export function useSimilarDocuments(userId: string) {
  // State
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Find similar documents
  const findSimilarDocuments = useCallback(
    async (documentId: string, limit = 5) => {
      setIsLoading(true)
      setError(null)

      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create a new abort controller
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      try {
        const response = await fetch(`/api/search/similar?documentId=${documentId}&limit=${limit}&userId=${userId}`, {
          signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(errorData?.error || `Failed to find similar documents: ${response.status}`)
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to find similar documents")
        }

        setResults(data.data.results)
        return data.data.results
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setError(error as Error)
          console.error("Error finding similar documents:", error)
        }
        return []
      } finally {
        setIsLoading(false)
      }
    },
    [userId],
  )

  return {
    findSimilarDocuments,
    similarDocuments: results,
    isLoading,
    error,
  }
}

/**
 * Hook for getting search analytics
 *
 * @param userId - User ID for the current user
 * @returns Search analytics data and functions
 */
export function useSearchAnalytics(userId: string) {
  // Get popular searches
  const { data, isLoading, error } = useQuery({
    queryKey: ["searchAnalytics", userId],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/search?userId=${userId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch search analytics")
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch search analytics")
      }

      return data.data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  })

  return {
    analytics: data,
    isLoading,
    error,
  }
}

/**
 * Hook for providing feedback on search results
 *
 * @param userId - User ID for the current user
 * @returns Functions for providing feedback
 */
export function useSearchFeedback(userId: string) {
  // Submit feedback on a search result
  const submitFeedback = useCallback(
    async (
      searchId: string,
      resultId: string,
      feedback: "relevant" | "not_relevant" | "partially_relevant",
      comments?: string,
    ) => {
      try {
        const response = await fetch("/api/search/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            searchId,
            resultId,
            feedback,
            comments,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to submit feedback")
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to submit feedback")
        }

        return true
      } catch (error) {
        console.error("Error submitting search feedback:", error)
        return false
      }
    },
    [userId],
  )

  return {
    submitFeedback,
  }
}

// Export the client API function for direct use
export { performSearch }
