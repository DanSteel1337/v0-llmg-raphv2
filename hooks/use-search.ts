"use client"

import { useState } from "react"

interface SearchResult {
  id: string
  title: string
  content: string
  documentName: string
  documentType: string
  date: string
  relevance: number
  highlights: string[]
}

interface SearchOptions {
  type: "semantic" | "keyword" | "hybrid"
  documentTypes?: string[]
  sortBy?: string
  dateRange?: { from?: Date; to?: Date }
}

export function useSearch(userId: string) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (query: string, options: SearchOptions) => {
    try {
      setIsSearching(true)
      setError(null)

      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          userId,
          type: options.type,
          documentTypes: options.documentTypes,
          sortBy: options.sortBy,
          dateRange: options.dateRange,
        }),
      })

      if (!response.ok) {
        throw new Error("Search failed")
      }

      const data = await response.json()
      setResults(data.results)

      return data.results
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error performing search:", err)
      return []
    } finally {
      setIsSearching(false)
    }
  }

  const clearResults = () => {
    setResults([])
  }

  return {
    results,
    isSearching,
    error,
    search,
    clearResults,
  }
}
