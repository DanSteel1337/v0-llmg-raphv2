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

import { useState } from "react"
import { Search, Clock } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useToast } from "@/components/toast"
import { useSearch } from "@/hooks/use-search"

interface SearchWidgetProps {
  userId: string
  recentSearches?: string[]
}

export function SearchWidget({ userId, recentSearches = [] }: SearchWidgetProps) {
  const [query, setQuery] = useState("")
  const { search, isLoading } = useSearch(userId)
  const { addToast } = useToast()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    try {
      await search(query)
      addToast(`Searching for: ${query}`, "info")
    } catch (error) {
      addToast("Search failed", "error")
    }
  }

  const handleRecentSearch = async (searchQuery: string) => {
    setQuery(searchQuery)
    try {
      await search(searchQuery)
      addToast(`Searching for: ${searchQuery}`, "info")
    } catch (error) {
      addToast("Search failed", "error")
    }
  }

  return (
    <DashboardCard title="Search" description="Search across your documents" isLoading={isLoading}>
      <div className="space-y-4">
        <form onSubmit={handleSearch}>
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
                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Search
              </button>
            </div>
          </div>
        </form>

        {recentSearches.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Recent Searches</h4>
            <ul className="space-y-1">
              {recentSearches.slice(0, 3).map((search, index) => (
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
