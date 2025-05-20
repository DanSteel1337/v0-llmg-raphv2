/**
 * Search API Route
 *
 * API endpoint for searching documents.
 *
 * Dependencies:
 * - @/services/search-service for search operations
 * - @/lib/api-utils for API response handling
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/validation for input validation
 * - @/lib/embedding-service for generating embeddings
 * - @/lib/pinecone-rest-client for vector operations
 * - @/lib/utils/logger for logging
 */

import type { NextRequest } from "next/server"
import { withErrorHandling } from "@/utils/errorHandling"
import { handleApiRequest } from "@/utils/apiRequest"
import { ValidationError } from "@/utils/validation"
import { generateEmbedding } from "@/lib/embedding-service"
import { queryVectors, createPlaceholderVector } from "@/lib/pinecone-rest-client"
import { logger } from "@/lib/utils/logger"

// Ensure the Edge runtime is declared
export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const userId = searchParams.get("userId")
      const query = searchParams.get("q")
      const type = (searchParams.get("type") as "semantic" | "keyword" | "hybrid") || "semantic"

      logger.info(`GET /api/search - Processing search request`, {
        userId,
        query,
        type,
      })

      if (!userId) {
        throw new ValidationError("User ID is required")
      }

      if (!query) {
        throw new ValidationError("Search query is required")
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

      try {
        // Log search query for analytics
        const placeholderVector = createPlaceholderVector()

        await queryVectors([
          {
            id: `search_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            values: placeholderVector,
            metadata: {
              user_id: userId,
              query,
              search_type: type,
              filters: JSON.stringify({
                documentTypes: documentTypes.length > 0 ? documentTypes : undefined,
                sortBy,
                dateRange,
              }),
              record_type: "search_history",
              created_at: new Date().toISOString(),
            },
          },
        ])
      } catch (logError) {
        // Don't fail the search if logging fails
        logger.error("GET /api/search - Error logging search query", {
          error: logError instanceof Error ? logError.message : "Unknown error",
        })
      }

      // Perform the search based on type
      try {
        let results = []

        if (type === "semantic" || type === "hybrid") {
          // Generate embedding for semantic search
          const embedding = await generateEmbedding(query)

          // Build filter
          const filter: any = {
            user_id: { $eq: userId },
            record_type: { $eq: "chunk" },
          }

          if (documentTypes.length > 0) {
            filter.document_type = { $in: documentTypes }
          }

          // Add date range filter if provided
          if (dateRange) {
            if (dateRange.from) {
              filter.created_at = { ...filter.created_at, $gte: dateRange.from.toISOString() }
            }
            if (dateRange.to) {
              filter.created_at = { ...filter.created_at, $lte: dateRange.to.toISOString() }
            }
          }

          // Query Pinecone
          const response = await queryVectors(embedding, 10, true, filter)

          // Format results
          if (response.matches && Array.isArray(response.matches)) {
            results = response.matches.map((match) => ({
              id: match.id,
              title: match.metadata?.document_name || "Unknown",
              content: match.metadata?.content || "",
              documentName: match.metadata?.document_name || "Unknown",
              documentType: match.metadata?.document_type || "Unknown",
              date: match.metadata?.created_at || new Date().toISOString(),
              relevance: match.score || 0,
              highlights: [match.metadata?.content?.substring(0, 150) + "..."] || [],
            }))
          }
        }

        if (type === "keyword" || type === "hybrid") {
          // Implement keyword search logic here
          // For now, we'll return an empty array
        }

        logger.info(`GET /api/search - Search completed successfully`, {
          userId,
          query,
          resultCount: results.length,
        })

        return { results }
      } catch (searchError) {
        logger.error("GET /api/search - Error performing search", {
          error: searchError instanceof Error ? searchError.message : "Unknown error",
          userId,
          query,
        })

        throw searchError
      }
    } catch (error) {
      logger.error("GET /api/search - Unexpected error", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
