/**
 * Analytics API Route
 *
 * Provides analytics data about documents, searches, and chats.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/pinecone-rest-client for vector operations
 * - @/lib/embedding-config for vector dimension configuration
 * - @/lib/utils/logger for logging
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { ValidationError } from "@/utils/validation"
import { queryVectors, createPlaceholderVector } from "@/lib/pinecone-rest-client"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

// Maximum number of vectors to query
const MAX_VECTORS_PER_QUERY = 10000

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const userId = searchParams.get("userId")
      const debug = searchParams.get("debug") === "true"

      logger.info(`GET /api/analytics - Fetching analytics for user`, { userId, debug })

      if (!userId) {
        throw new ValidationError("User ID is required")
      }

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Get document count
      const documentResult = await queryVectors(placeholderVector, MAX_VECTORS_PER_QUERY, true, {
        record_type: "document",
        user_id: userId,
      })

      // Get chunk count
      const chunkResult = await queryVectors(placeholderVector, MAX_VECTORS_PER_QUERY, true, {
        record_type: "chunk",
        user_id: userId,
      })

      // Get search count
      const searchResult = await queryVectors(placeholderVector, MAX_VECTORS_PER_QUERY, true, {
        record_type: "search_history",
        user_id: userId,
      })

      // Get chat count
      const chatResult = await queryVectors(placeholderVector, MAX_VECTORS_PER_QUERY, true, {
        record_type: "message",
        user_id: userId,
      })

      // Ensure matches are arrays
      const documentMatches = Array.isArray(documentResult.matches) ? documentResult.matches : []
      const chunkMatches = Array.isArray(chunkResult.matches) ? chunkResult.matches : []
      const searchMatches = Array.isArray(searchResult.matches) ? searchResult.matches : []
      const chatMatches = Array.isArray(chatResult.matches) ? chatResult.matches : []

      // Extract counts
      const documentCount = documentMatches.length
      const chunkCount = chunkMatches.length
      const searchCount = searchMatches.length
      const chatCount = chatMatches.length

      // Get top documents (by chunk count)
      const topDocuments = documentMatches
        .map((match) => ({
          id: match.metadata?.document_id || "",
          name: match.metadata?.name || "",
          chunkCount: match.metadata?.chunk_count || 0,
          createdAt: match.metadata?.created_at || "",
        }))
        .sort((a, b) => b.chunkCount - a.chunkCount)
        .slice(0, 5)

      // Get top searches
      const topSearches = searchMatches
        .map((match) => ({
          query: match.metadata?.query || "",
          count: 1, // We count each search as 1 since we don't have aggregation
          timestamp: match.metadata?.created_at || "",
        }))
        .slice(0, 5)

      const analyticsData = {
        documentCount,
        chunkCount,
        searchCount,
        chatCount,
        topDocuments,
        topSearches,
        // Indicate if counts might be truncated
        mightBeTruncated: {
          documents: documentCount >= MAX_VECTORS_PER_QUERY,
          chunks: chunkCount >= MAX_VECTORS_PER_QUERY,
          searches: searchCount >= MAX_VECTORS_PER_QUERY,
          chats: chatCount >= MAX_VECTORS_PER_QUERY,
        },
      }

      logger.info(`GET /api/analytics - Successfully fetched analytics data`, {
        userId,
        documentCount,
        searchCount,
        chatCount,
        chunkCount,
      })

      return analyticsData
    } catch (error) {
      logger.error("GET /api/analytics - Error fetching analytics", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
