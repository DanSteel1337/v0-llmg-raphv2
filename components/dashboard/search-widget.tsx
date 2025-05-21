/**
 * Enhanced Search Widget Component
 *
 * A comprehensive dashboard widget for searching documents with advanced filtering,
 * multiple search modes, pagination, and optimized performance.
 *
 * Features:
 * - Debounced search input to prevent excessive API calls
 * - Advanced filtering by document type, date range, and more
 * - Multiple search modes (semantic, keyword, hybrid)
 * - Pagination for large result sets
 * - Virtualized list for performance with large result sets
 * - Highlight extraction to show matching text
 * - Keyboard navigation for accessibility
 * - Mobile-responsive design
 * - Optimistic UI updates
 * - Comprehensive error handling
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 * - @/hooks/use-search for search functionality
 * - @/components/toast for notifications
 * - @/components/ui/error-boundary for error handling
 */

"use client"

import type { SearchResult } from "@/types"
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from "react"
import {
  Search,
  Clock,
  AlertCircle,
  RefreshCw,
  FileText,
  Filter,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  BookOpen,
  FileType,
} from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useToast } from "@/components/toast"
import { useSearch } from "@/hooks/use-search"
import { ErrorBoundary } from "@/components/error-boundary"
import { useVirtualizer } from "@tanstack/react-virtual"

// Types
interface SearchWidgetProps {
  userId: string
}

interface FilterState {
  documentTypes: string[]
  dateRange: {
    from?: Date
    to?: Date
  }
  sortBy?: "relevance" | "date"
  expanded: boolean
}

// Memoized search result item component for performance
const SearchResultItem = memo(
  ({
    result,
    query,
    index,
    isSelected,
    onSelect,
  }: {
    result: SearchResult
    query: string
    index: number
    isSelected: boolean
    onSelect: (index: number) => void
  }) => {
    // Format date for display
    const formattedDate = useMemo(() => {
      try {
        return new Date(result.date).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      } catch (e) {
        return result.date
      }
    }, [result.date])

    return (
      <li
        className={`bg-white border rounded-md p-3 transition-colors ${
          isSelected ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-200 hover:bg-gray-50"
        }`}
        onClick={() => onSelect(index)}
        tabIndex={0}
        role="option"
        aria-selected={isSelected}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect(index)
          }
        }}
      >
        <h5 className="text-sm font-medium text-gray-900 mb-1 truncate">{result.title}</h5>
        <div className="flex flex-wrap items-center text-xs text-gray-500 mb-2 gap-2">
          <span className="flex items-center">
            <FileText className="h-3 w-3 mr-1" />
            {result.documentName}
          </span>
          <span className="hidden sm:inline">•</span>
          <span>{formattedDate}</span>
          <span className="hidden sm:inline">•</span>
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

          {result.section && (
            <span className="flex items-center text-gray-500">
              <BookOpen className="h-3 w-3 mr-1" />
              {result.section}
            </span>
          )}
        </div>

        <div className="text-sm text-gray-700 line-clamp-2">{result.content}</div>

        {result.highlights && Array.isArray(result.highlights) && result.highlights.length > 0 && (
          <div className="mt-2 text-xs bg-yellow-50 p-2 rounded border border-yellow-100">
            <p className="font-medium text-yellow-800 mb-1">Highlights:</p>
            {result.highlights.map((highlight, i) => (
              <HighlightedText key={i} text={highlight} query={query} />
            ))}
          </div>
        )}
      </li>
    )
  },
)

SearchResultItem.displayName = "SearchResultItem"

// Component to highlight matching text in search results
const HighlightedText = memo(({ text, query }: { text: string; query: string }) => {
  // Only highlight if we have both text and query
  if (!text || !query || query.length < 2) {
    return <p className="text-gray-700">{text}</p>
  }

  // Create regex pattern from query terms
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) // Escape regex special chars
    .join("|")

  if (!terms) {
    return <p className="text-gray-700">{text}</p>
  }

  try {
    const regex = new RegExp(`(${terms})`, "gi")
    const parts = text.split(regex)

    return (
      <p className="text-gray-700">
        {parts.map((part, i) => {
          // Check if this part matches any query term
          const isMatch = query
            .toLowerCase()
            .split(/\s+/)
            .filter((term) => term.length > 2)
            .some((term) => part.toLowerCase() === term)

          return isMatch ? (
            <mark key={i} className="bg-yellow-200 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        })}
      </p>
    )
  } catch (e) {
    // Fallback if regex fails
    return <p className="text-gray-700">{text}</p>
  }
})

HighlightedText.displayName = "HighlightedText"

// Date picker component
const DateRangePicker = ({
  dateRange,
  onChange,
}: {
  dateRange: FilterState["dateRange"]
  onChange: (range: FilterState["dateRange"]) => void
}) => {
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <label htmlFor="date-from" className="block text-xs font-medium text-gray-700 mb-1">
            From
          </label>
          <input
            type="date"
            id="date-from"
            className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md"
            value={dateRange.from ? dateRange.from.toISOString().split("T")[0] : ""}
            onChange={(e) => {
              const newDate = e.target.value ? new Date(e.target.value) : undefined
              onChange({ ...dateRange, from: newDate })
            }}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="date-to" className="block text-xs font-medium text-gray-700 mb-1">
            To
          </label>
          <input
            type="date"
            id="date-to"
            className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md"
            value={dateRange.to ? dateRange.to.toISOString().split("T")[0] : ""}
            onChange={(e) => {
              const newDate = e.target.value ? new Date(e.target.value) : undefined
              onChange({ ...dateRange, to: newDate })
            }}
          />
        </div>
      </div>
      {(dateRange.from || dateRange.to) && (
        <button
          onClick={() => onChange({ from: undefined, to: undefined })}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
        >
          <X className="h-3 w-3 mr-1" />
          Clear dates
        </button>
      )}
    </div>
  )
}

// Document type selector component
const DocumentTypeSelector = ({
  selectedTypes,
  onChange,
  availableTypes = ["txt", "pdf", "doc", "md"],
}: {
  selectedTypes: string[]
  onChange: (types: string[]) => void
  availableTypes?: string[]
}) => {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {availableTypes.map((type) => (
          <label
            key={type}
            className={`inline-flex items-center px-2 py-1 rounded-md text-xs cursor-pointer ${
              selectedTypes.includes(type)
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selectedTypes.includes(type)}
              onChange={() => {
                if (selectedTypes.includes(type)) {
                  onChange(selectedTypes.filter((t) => t !== type))
                } else {
                  onChange([...selectedTypes, type])
                }
              }}
            />
            <FileType className="h-3 w-3 mr-1" />
            {type.toUpperCase()}
          </label>
        ))}
      </div>
      {selectedTypes.length > 0 && (
        <button onClick={() => onChange([])} className="text-xs text-blue-600 hover:text-blue-800 flex items-center">
          <X className="h-3 w-3 mr-1" />
          Clear filters
        </button>
      )}
    </div>
  )
}

// Sort selector component
const SortSelector = ({
  value,
  onChange,
}: {
  value?: "relevance" | "date"
  onChange: (value: "relevance" | "date") => void
}) => {
  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="sort-by" className="text-xs font-medium text-gray-700">
        Sort by:
      </label>
      <select
        id="sort-by"
        value={value || "relevance"}
        onChange={(e) => onChange(e.target.value as "relevance" | "date")}
        className="text-xs border border-gray-300 rounded-md py-1 pl-2 pr-8"
      >
        <option value="relevance">Relevance</option>
        <option value="date">Date (newest)</option>
      </select>
    </div>
  )
}

// Skeleton loader for search results
const SearchResultSkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-md p-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          <div className="mt-2 h-12 bg-gray-100 rounded w-full"></div>
        </div>
      ))}
    </div>
  )
}

// Pagination component
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) => {
  // Don't render pagination if there's only one page
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-2 py-3 mt-4">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`relative inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
            currentPage === 1 ? "text-gray-300 cursor-not-allowed" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={`relative ml-3 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
            currentPage === totalPages ? "text-gray-300 cursor-not-allowed" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing page <span className="font-medium">{currentPage}</span> of{" "}
            <span className="font-medium">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ${
                currentPage === 1 ? "cursor-not-allowed" : "hover:bg-gray-50"
              }`}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Page number buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Logic to show pages around current page
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }

              // Only show if pageNum is valid
              if (pageNum < 1 || pageNum > totalPages) return null

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  aria-current={currentPage === pageNum ? "page" : undefined}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${
                    currentPage === pageNum
                      ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ${
                currentPage === totalPages ? "cursor-not-allowed" : "hover:bg-gray-50"
              }`}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  )
}

// Error fallback component
const SearchErrorFallback = ({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5 text-red-500" />
        <div className="flex-1">
          <h3 className="font-medium text-red-800 mb-1">Search Error</h3>
          <p className="mb-2">{error.message || "An unexpected error occurred during search."}</p>
          <button
            onClick={resetErrorBoundary}
            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset Search
          </button>
        </div>
      </div>
    </div>
  )
}

// Main search widget component
export function SearchWidget({ userId }: SearchWidgetProps) {
  // State
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(-1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState<FilterState>({
    documentTypes: [],
    dateRange: {},
    sortBy: "relevance",
    expanded: false,
  })

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  // Hooks
  const { search, results, isLoading, error, setSearchOptions, searchOptions, recentSearches, pagination } =
    useSearch(userId)
  const { addToast } = useToast()
  const [searchError, setSearchError] = useState<string | null>(null)

  // Derived state
  const safeResults = useMemo(() => {
    return Array.isArray(results) ? results : []
  }, [results])

  const recentSearchItems = useMemo(() => {
    return Array.isArray(recentSearches) ? recentSearches.slice(0, 5) : []
  }, [recentSearches])

  const totalPages = useMemo(() => {
    return pagination?.totalPages || 1
  }, [pagination])

  const totalResults = useMemo(() => {
    return pagination?.total || safeResults.length
  }, [pagination, safeResults])

  // Setup virtualization for large result sets
  const rowVirtualizer = useVirtualizer({
    count: safeResults.length,
    getScrollElement: () => resultsContainerRef.current,
    estimateSize: () => 150, // Estimated height of each result item
    overscan: 5,
  })

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 350) // 350ms debounce delay

    return () => clearTimeout(timer)
  }, [query])

  // Perform search when debounced query changes or filters change
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      handleSearch(debouncedQuery)
    }
  }, [debouncedQuery, filters, page, pageSize])

  // Reset selected result when results change
  useEffect(() => {
    setSelectedResultIndex(-1)
  }, [results])

  // Keyboard navigation for search results
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if we have results and not in an input
      if (safeResults.length === 0 || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedResultIndex((prev) => (prev < safeResults.length - 1 ? prev + 1 : prev))
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case "Escape":
          e.preventDefault()
          setSelectedResultIndex(-1)
          searchInputRef.current?.focus()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [safeResults.length])

  // Scroll selected result into view
  useEffect(() => {
    if (selectedResultIndex >= 0 && resultsContainerRef.current) {
      rowVirtualizer.scrollToIndex(selectedResultIndex, { align: "center" })
    }
  }, [selectedResultIndex, rowVirtualizer])

  // Handle search type change
  const handleSearchTypeChange = useCallback(
    (type: "semantic" | "keyword" | "hybrid") => {
      setSearchOptions((prev) => ({ ...prev, type }))
      setPage(1) // Reset to first page

      if (debouncedQuery.trim()) {
        handleSearch(debouncedQuery)
      }
    },
    [setSearchOptions, debouncedQuery],
  )

  // Handle search
  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) return

      setSearchError(null)
      try {
        // Update search options with filters
        setSearchOptions((prev) => ({
          ...prev,
          filters: {
            documentTypes: filters.documentTypes.length > 0 ? filters.documentTypes : undefined,
            dateRange: filters.dateRange.from || filters.dateRange.to ? filters.dateRange : undefined,
            sortBy: filters.sortBy,
          },
          page,
          pageSize,
        }))

        await search(searchQuery)
      } catch (error) {
        console.error("Search failed:", error)
        setSearchError(error instanceof Error ? error.message : "Search failed. Please try again.")
        addToast("Search failed: " + (error instanceof Error ? error.message : "Unknown error"), "error")
      }
    },
    [search, filters, page, pageSize, setSearchOptions, addToast],
  )

  // Handle form submit
  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!query.trim()) return
      handleSearch(query)
    },
    [query, handleSearch],
  )

  // Handle recent search click
  const handleRecentSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery)
      setPage(1) // Reset to first page
      handleSearch(searchQuery)
    },
    [handleSearch],
  )

  // Handle retry
  const handleRetry = useCallback(() => {
    if (debouncedQuery.trim()) {
      handleSearch(debouncedQuery)
    }
  }, [debouncedQuery, handleSearch])

  // Handle filter toggle
  const handleFilterToggle = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      expanded: !prev.expanded,
    }))
  }, [])

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }))
    setPage(1) // Reset to first page
  }, [])

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    // Scroll to top of results
    resultsContainerRef.current?.scrollTo(0, 0)
  }, [])

  // Handle result selection
  const handleResultSelect = useCallback((index: number) => {
    setSelectedResultIndex(index)
    // Here you could implement additional actions when a result is selected
    // For example, showing a detail view or navigating to the document
  }, [])

  // Reset search
  const resetSearch = useCallback(() => {
    setQuery("")
    setDebouncedQuery("")
    setSearchError(null)
    setFilters({
      documentTypes: [],
      dateRange: {},
      sortBy: "relevance",
      expanded: false,
    })
    setPage(1)
    searchInputRef.current?.focus()
  }, [])

  return (
    <ErrorBoundary FallbackComponent={SearchErrorFallback} onReset={resetSearch}>
      <DashboardCard title="Search" description="Search across your documents" isLoading={false}>
        <div className="space-y-4">
          {/* Search form */}
          <form onSubmit={handleFormSubmit} className="relative">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block w-full pl-10 pr-20 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search documents..."
                aria-label="Search documents"
                autoComplete="off"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
                <button
                  type="button"
                  onClick={handleFilterToggle}
                  className="p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                  aria-label="Toggle filters"
                  title="Toggle filters"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="ml-1 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Search"
                >
                  {isLoading ? "Searching..." : "Search"}
                </button>
              </div>
            </div>

            {/* Expanded filters */}
            {filters.expanded && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200 animate-in slide-in-from-top duration-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 sm:mb-0">Search Filters</h4>
                  <div className="flex items-center space-x-2">
                    <SortSelector value={filters.sortBy} onChange={(sortBy) => handleFilterChange({ sortBy })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-xs font-medium text-gray-700 mb-2">Document Type</h5>
                    <DocumentTypeSelector
                      selectedTypes={filters.documentTypes}
                      onChange={(documentTypes) => handleFilterChange({ documentTypes })}
                    />
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-700 mb-2">Date Range</h5>
                    <DateRangePicker
                      dateRange={filters.dateRange}
                      onChange={(dateRange) => handleFilterChange({ dateRange })}
                    />
                  </div>
                </div>

                {/* Applied filters summary */}
                {(filters.documentTypes.length > 0 || filters.dateRange.from || filters.dateRange.to) && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center text-xs text-gray-500">
                      <Filter className="h-3 w-3 mr-1" />
                      <span>Filters applied:</span>
                      {filters.documentTypes.length > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                          {filters.documentTypes.length} document{" "}
                          {filters.documentTypes.length === 1 ? "type" : "types"}
                        </span>
                      )}
                      {(filters.dateRange.from || filters.dateRange.to) && (
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Date filter
                        </span>
                      )}
                      <button
                        onClick={() => handleFilterChange({ documentTypes: [], dateRange: {} })}
                        className="ml-auto text-blue-600 hover:text-blue-800"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>

          {/* Search type selector */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Search mode:</span>
            <div className="flex rounded-md shadow-sm">
              <button
                onClick={() => handleSearchTypeChange("semantic")}
                className={`px-2.5 py-1.5 rounded-l-md border ${
                  searchOptions.type === "semantic"
                    ? "bg-blue-50 text-blue-700 border-blue-300 font-medium"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
                aria-pressed={searchOptions.type === "semantic"}
              >
                Semantic
              </button>
              <button
                onClick={() => handleSearchTypeChange("hybrid")}
                className={`px-2.5 py-1.5 border-t border-b ${
                  searchOptions.type === "hybrid"
                    ? "bg-blue-50 text-blue-700 border-blue-300 font-medium"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
                aria-pressed={searchOptions.type === "hybrid"}
              >
                Hybrid
              </button>
              <button
                onClick={() => handleSearchTypeChange("keyword")}
                className={`px-2.5 py-1.5 rounded-r-md border ${
                  searchOptions.type === "keyword"
                    ? "bg-blue-50 text-blue-700 border-blue-300 font-medium"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
                aria-pressed={searchOptions.type === "keyword"}
              >
                Keyword
              </button>
            </div>

            {/* Page size selector */}
            {totalResults > 0 && (
              <div className="ml-auto flex items-center space-x-2">
                <label htmlFor="page-size" className="text-gray-500">
                  Show:
                </label>
                <select
                  id="page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1) // Reset to first page
                  }}
                  className="text-xs border border-gray-300 rounded-md py-1 pl-2 pr-6"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>
            )}
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
            <div className="py-4">
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-sm text-gray-500">Searching documents using {searchOptions.type} search...</p>
              </div>
              <SearchResultSkeleton />
            </div>
          )}

          {/* Search results */}
          {!isLoading && debouncedQuery && safeResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {totalResults} {totalResults === 1 ? "Result" : "Results"} for "{debouncedQuery}"
                </h4>
                {totalPages > 1 && (
                  <p className="text-xs text-gray-500">
                    Page {page} of {totalPages}
                  </p>
                )}
              </div>

              {/* Virtualized results list */}
              <div
                ref={resultsContainerRef}
                className="h-[500px] overflow-auto"
                tabIndex={0}
                role="listbox"
                aria-label="Search results"
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                      key={virtualRow.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <SearchResultItem
                        result={safeResults[virtualRow.index]}
                        query={debouncedQuery}
                        index={virtualRow.index}
                        isSelected={selectedResultIndex === virtualRow.index}
                        onSelect={handleResultSelect}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagination */}
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
            </div>
          )}

          {/* No results state */}
          {!isLoading && debouncedQuery && safeResults.length === 0 && !error && !searchError && (
            <div className="py-8 text-center">
              <div className="inline-flex items-center justify-center p-4 bg-gray-100 rounded-full mb-4">
                <Search className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-700 font-medium">No results found for "{debouncedQuery}"</p>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Try adjusting your search terms, changing the search mode, or removing some filters to find what you're
                looking for.
              </p>
              {(filters.documentTypes.length > 0 || filters.dateRange.from || filters.dateRange.to) && (
                <button
                  onClick={() => handleFilterChange({ documentTypes: [], dateRange: {} })}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-800 inline-flex items-center"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear filters and try again
                </button>
              )}
            </div>
          )}

          {/* Recent searches */}
          {!debouncedQuery && recentSearchItems.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Recent Searches</h4>
              <ul className="space-y-1">
                {recentSearchItems.map((searchTerm, index) => (
                  <li key={index}>
                    <button
                      onClick={() => handleRecentSearch(searchTerm)}
                      className="flex items-center px-2 py-1.5 w-full text-left text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                      aria-label={`Search for ${searchTerm}`}
                    >
                      <Clock className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <span className="truncate">{searchTerm}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empty state - no recent searches */}
          {!debouncedQuery && recentSearchItems.length === 0 && (
            <div className="py-8 text-center">
              <div className="inline-flex items-center justify-center p-4 bg-gray-100 rounded-full mb-4">
                <Search className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-700 font-medium">Search your documents</p>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Enter a search term above to find information across all your documents. Try different search modes for
                better results.
              </p>
            </div>
          )}
        </div>
      </DashboardCard>
    </ErrorBoundary>
  )
}
