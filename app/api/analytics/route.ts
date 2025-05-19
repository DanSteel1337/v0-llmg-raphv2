/**
 * Analytics API Route
 *
 * API endpoint for fetching analytics data from Pinecone.
 *
 * Dependencies:
 * - @/lib/pinecone-rest-client.ts for vector database access
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { queryVectors } from "@/lib/pinecone-rest-client"
import { handleApiRequest, extractUserId } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"
import type { AnalyticsData } from "@/types"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const userId = extractUserId(request)
      console.log(`GET /api/analytics - Fetching analytics for user`, { userId })

      // Get document count
      console.log(`GET /api/analytics - Querying document count`)
      const documentQuery = await queryVectors(new Array(1536).fill(0), 1, true, {
        user_id: { $eq: userId },
        record_type: { $eq: "document" },
      })
      const documentCount = documentQuery.matches?.length || 0
      console.log(`GET /api/analytics - Document count query result`, { documentCount })

      // Get search count
      console.log(`GET /api/analytics - Querying search count`)
      const searchQuery = await queryVectors(new Array(1536).fill(0), 1, true, {
        user_id: { $eq: userId },
        record_type: { $eq: "search_history" },
      })
      const searchCount = searchQuery.matches?.length || 0
      console.log(`GET /api/analytics - Search count query result`, { searchCount })

      // Get chat count
      console.log(`GET /api/analytics - Querying chat count`)
      const chatQuery = await queryVectors(new Array(1536).fill(0), 1, true, {
        user_id: { $eq: userId },
        record_type: { $eq: "conversation" },
      })
      const chatCount = chatQuery.matches?.length || 0
      console.log(`GET /api/analytics - Chat count query result`, { chatCount })

      // Construct analytics data
      const analyticsData: AnalyticsData = {
        documentCount,
        searchCount,
        chatCount,
        topDocuments: [],
        topSearches: [],
      }

      console.log(`GET /api/analytics - Successfully fetched analytics data`, {
        userId,
        documentCount,
        searchCount,
        chatCount,
      })

      return analyticsData
    } catch (error) {
      console.error("GET /api/analytics - Error fetching analytics", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
      })
      throw error
    }
  })
})
