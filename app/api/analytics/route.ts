/**
 * Analytics API Route
 *
 * API endpoint for fetching analytics data from Pinecone.
 *
 * Dependencies:
 * - @/services/analytics-service.ts for analytics operations
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { handleApiRequest, extractUserId, createSuccessResponse } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"
import { queryVectors } from "@/lib/pinecone-rest-client"

export const runtime = "edge"

// Maximum number of vectors to query
const MAX_VECTORS_PER_QUERY = 10000
const VECTOR_DIMENSION = 1536

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const userId = extractUserId(request) || searchParams.get("userId")
      const debug = searchParams.get("debug") === "true"

      console.log(`GET /api/analytics - Fetching analytics for user`, { userId, debug })

      if (!userId) {
        throw new Error("User ID is required")
      }

      // Create a dummy vector for querying
      const dummyVector = new Array(VECTOR_DIMENSION).fill(0.001)

      // Get document count
      const documentResult = await queryVectors(dummyVector, MAX_VECTORS_PER_QUERY, true, {
        record_type: "document",
        user_id: userId,
      })

      // Get chunk count
      const chunkResult = await queryVectors(dummyVector, MAX_VECTORS_PER_QUERY, true, {
        record_type: "chunk",
        user_id: userId,
      })

      // Get search count
      const searchResult = await queryVectors(dummyVector, MAX_VECTORS_PER_QUERY, true, {
        record_type: "search_history",
        user_id: userId,
      })

      // Get chat count
      const chatResult = await queryVectors(dummyVector, MAX_VECTORS_PER_QUERY, true, {
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

      console.log(`GET /api/analytics - Successfully fetched analytics data`, {
        userId,
        documentCount,
        searchCount,
        chatCount,
        chunkCount,
      })

      // Include debug information if requested
      if (debug) {
        return {
          ...analyticsData,
          debug: {
            documentResult: {
              matchCount: documentMatches.length,
              error: documentResult.error || false,
            },
            chunkResult: {
              matchCount: chunkMatches.length,
              error: chunkResult.error || false,
            },
            searchResult: {
              matchCount: searchMatches.length,
              error: searchResult.error || false,
            },
            chatResult: {
              matchCount: chatMatches.length,
              error: chatResult.error || false,
            },
          },
        }
      }

      return analyticsData
    } catch (error) {
      console.error("GET /api/analytics - Error fetching analytics", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
      })

      // Return fallback data instead of throwing
      return createSuccessResponse({
        documentCount: 0,
        searchCount: 0,
        chatCount: 0,
        chunkCount: 0,
        topDocuments: [],
        topSearches: [],
        mightBeTruncated: {
          documents: false,
          chunks: false,
          searches: false,
          chats: false,
        },
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  })
})
