/**
 * Search API Route
 *
 * API endpoint for searching documents.
 *
 * Dependencies:
 * - @/services/search-service for search operations
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { performSearch } from "@/services/search-service"
import { handleApiRequest } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const query = searchParams.get("q")
    const type = (searchParams.get("type") as "semantic" | "keyword" | "hybrid") || "semantic"

    if (!userId) {
      throw new Error("User ID is required")
    }

    if (!query) {
      throw new Error("Search query is required")
    }

    // Parse document types
    const documentTypes = searchParams.getAll("documentType")

    // Parse sort option
    const sortBy = searchParams.get("sortBy") || undefined

    // Parse date range
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const dateRange = from || to ? {} : undefined

    if (from) {
      dateRange!.from = new Date(from)
    }

    if (to) {
      dateRange!.to = new Date(to)
    }

    const results = await performSearch(query, userId, {
      type,
      documentTypes: documentTypes.length > 0 ? documentTypes : undefined,
      sortBy,
      dateRange,
    })

    return { results }
  })
})
