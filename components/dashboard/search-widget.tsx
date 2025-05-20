/**
 * Search Widget Component
 *
 * A dashboard widget for quick search functionality, allowing users
 * to search documents and view recent searches.
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 * - @/hooks/use-search for search functionality
 */

"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, Clock, AlertCircle, RefreshCw, FileText } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useToast } from "@/components/toast"
import { useSearch } from "@/hooks/use-search"
import type { SearchOptions } from "@/types"

interface SearchWidgetProps {
  userId: string
}

// Default search options to use as fallback
const defaultSearchOptions: SearchOptions = {
  type: "semantic",
  documentTypes: [],
  sortBy: "relevance",
  dateRange: undefined,
}

export function SearchWidget({ userId }: SearchWidgetProps) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const { search, results, isLoading, error, recentSearches } = useSearch(userId)
  const { addToast } = useToast()
  const [searchError, setSearchError] = useState<string | null>(null)

  // Initialize local search options state
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(defaultSearchOptions)

  // Ensure results is always an array
  const safeResults = Array.isArray(results) ? results : []
  // Get the recent searches safely
  const recentSearchItems = Array.isArray(recentSearches) ? recentSearches.slice(0, 3) : []

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 500) // 500ms debounce delay

    return () => clearTimeout(timer)
  }, [query])

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      handleSearch(debouncedQuery)
    }
  }, [debouncedQuery])

  // Handle search type change
  const handleSearchTypeChange = (type: "semantic" | "keyword" | "hybrid") => {
    setSearchOptions({ ...searchOptions, type })
    if (debouncedQuery.trim()) {
      handleSearch(debouncedQuery, { ...searchOptions, type })
    }
  }

  const handleSearch = async (searchQuery: string, options = searchOptions) => {
    if (!searchQuery.trim()) return

    setSearchError(null)
    try {
      await search(searchQuery, options)
    } catch (error) {
      console.error("Search failed:", error)
      setSearchError(error instanceof Error ? error.message : "Search failed. Please try again.")
      addToast("Search failed: " + (error instanceof Error ? error.message : "Unknown error"), "error")
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    handleSearch(query)
  }

  const handleRecentSearch = async (searchQuery: string) => {
    setQuery(searchQuery)
    handleSearch(searchQuery)
  }

  const handleRetry = () => {
    if (debouncedQuery.trim()) {
      handleSearch(debouncedQuery)
    }
  }

  return (
    <DashboardCard title="Search" description="Search across your documents" isLoading={false}>
      <div className="space-y-4">
        <form onSubmit={handleFormSubmit}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search documents..."
            />
            <div className="absolute inset-y-0 right-0 flex py-1.5 pr-1.5">
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
        </form>

        {/* Search type selector */}
        <div className="flex space-x-2 text-xs">
          <span className="text-gray-500">Search type:</span>
          <button
            onClick={() => handleSearchTypeChange("semantic")}
            className={`px-2 py-1 rounded-md ${
              searchOptions.type === "semantic"
                ? "bg-blue-100 text-blue-600 font-medium"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            Semantic
          </button>
          <button
            onClick={() => handleSearchTypeChange("keyword")}
            className={`px-2 py-1 rounded-md ${
              searchOptions.type === "keyword"
                ? "bg-blue-100 text-blue-600 font-medium"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            Keyword
          </button>
          <button
            onClick={() => handleSearchTypeChange("hybrid")}
            className={`px-2 py-1 rounded-md ${
              searchOptions.type === "hybrid"
                ? "bg-blue-100 text-blue-600 font-medium"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            Hybrid
          </button>
        </div>

        {/* Error message */}
        {(error || searchError) && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error instanceof Error ? error.message : searchError || "Search failed. Please try again."}</p>
              <button
                onClick={handleRetry}
                className="mt-2 inline-flex items-center text-xs font-medium text-red-700 hover:text-red-900"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry search
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="py-8">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-sm text-gray-500">Searching documents using {searchOptions.type} search...</p>
            </div>
          </div>
        )}

        {/* Search results */}
        {!isLoading && debouncedQuery && safeResults.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {safeResults.length} {safeResults.length === 1 ? "Result" : "Results"} for "{debouncedQuery}"
            </h4>
            <ul className="space-y-3">
              {safeResults.map((result) => (
                <li key={result.id} className="bg-white border border-gray-200 rounded-md p-3 hover:bg-gray-50">
                  <h5 className="text-sm font-medium text-gray-900 mb-1 truncate">{result.title}</h5>
                  <div className="flex items-center text-xs text-gray-500 mb-2">
                    <span className="flex items-center">
                      <FileText className="h-3 w-3 mr-1" />
                      {result.documentName}
                    </span>
                    <span className="mx-2">•</span>
                    <span>{result.date}</span>
                    <span className="mx-2">•</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full ${
                        result.relevance > 0.8
                          ? "bg-green-100 text-green-800"
                          : result.relevance > 0.5
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {Math.round(result.relevance * 100)}% match
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 line-clamp-2">{result.content}</div>
                  {result.highlights && Array.isArray(result.highlights) && result.highlights.length > 0 && (
                    <div className="mt-2 text-xs bg-yellow-50 p-2 rounded border border-yellow-100">
                      <p className="font-medium text-yellow-800 mb-1">Highlights:</p>
                      <p className="text-gray-700">{result.highlights[0]}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* No results state */}
        {!isLoading && debouncedQuery && safeResults.length === 0 && !error && !searchError && (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">No results found for "{debouncedQuery}"</p>
            <p className="text-xs text-gray-400 mt-1">Try a different search term or search type</p>
          </div>
        )}

        {/* Recent searches */}
        {!debouncedQuery && recentSearchItems.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Recent Searches</h4>
            <ul className="space-y-1">
              {recentSearchItems.map((search, index) => (
                <li key={index}>
                  <button
                    onClick={() => handleRecentSearch(search)}
                    className="flex items-center px-2 py-1 w-full text-left text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    <Clock className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="truncate">{search}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardCard>
  )
}
