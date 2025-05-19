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
    const userId = extractUserId(request)

    // Get document count
    const documentQuery = await queryVectors(new Array(1536).fill(0), 1, true, {
      user_id: { $eq: userId },
      record_type: { $eq: "document" },
    })

    const documentCount = documentQuery.matches?.length || 0

    // Get search count
    const searchQuery = await queryVectors(new Array(1536).fill(0), 1, true, {
      user_id: { $eq: userId },
      record_type: { $eq: "search_history" },
    })

    const searchCount = searchQuery.matches?.length || 0

    // Get chat count
    const chatQuery = await queryVectors(new Array(1536).fill(0), 1, true, {
      user_id: { $eq: userId },
      record_type: { $eq: "conversation" },
    })

    const chatCount = chatQuery.matches?.length || 0

    // Construct analytics data
    const analyticsData: AnalyticsData = {
      documentCount,
      searchCount,
      chatCount,
      topDocuments: [],
      topSearches: [],
    }

    return analyticsData
  })
})
