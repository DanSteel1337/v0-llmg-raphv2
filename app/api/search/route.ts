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
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"
import { logSearchQuery } from "@/services/search-service"

// Ensure the Edge runtime is declared
export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const query = searchParams.get("q")
    const type = (searchParams.get("type") as "semantic" | "keyword" | "hybrid") || "semantic"

    console.log(`GET /api/search - Processing search request`, {
      userId,
      query,
      type,
    })

    if (!userId) {
      console.error("GET /api/search - Missing userId parameter")
      return createErrorResponse("User ID is required", 400)
    }

    if (!query) {
      console.error("GET /api/search - Missing query parameter")
      return createErrorResponse("Search query is required", 400)
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

    // Log search query for analytics
    try {
      await logSearchQuery(userId, query, type, {
        documentTypes: documentTypes.length > 0 ? documentTypes : undefined,
        sortBy,
        dateRange,
      })
    } catch (logError) {
      // Don't fail the search if logging fails
      console.error("GET /api/search - Error logging search query", {
        error: logError instanceof Error ? logError.message : "Unknown error",
      })
    }

    try {
      const results = await performSearch(query, userId, {
        type,
        documentTypes: documentTypes.length > 0 ? documentTypes : undefined,
        sortBy,
        dateRange,
      })

      console.log(`GET /api/search - Search completed successfully`, {
        userId,
        query,
        resultCount: results.length,
      })

      return createSuccessResponse({ results })
    } catch (searchError) {
      console.error("GET /api/search - Error performing search", {
        error: searchError instanceof Error ? searchError.message : "Unknown error",
        userId,
        query,
      })

      // If it's an OpenAI error, return empty results instead of failing
      if (
        searchError instanceof Error &&
        (searchError.message.includes("OpenAI") || searchError.message.includes("embedding"))
      ) {
        console.log("GET /api/search - OpenAI error, returning empty results")
        return createSuccessResponse({ results: [] })
      }

      // If it's a Pinecone error, return error response
      return createErrorResponse(
        `Search failed: ${searchError instanceof Error ? searchError.message : "Unknown error"}`,
        500,
      )
    }
  } catch (error) {
    console.error("GET /api/search - Unexpected error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      url: request.url,
    })
    return createErrorResponse("An unexpected error occurred", 500)
  }
})
