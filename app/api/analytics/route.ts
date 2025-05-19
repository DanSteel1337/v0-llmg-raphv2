/**
 * Analytics API Route
 *
 * API endpoint for fetching analytics data from Pinecone.
 *
 * Dependencies:
 * - @/lib/pinecone-client for vector database access
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { getPineconeIndex } from "@/lib/pinecone-client"
import { handleApiRequest, extractUserId } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"
import type { AnalyticsData } from "@/types"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const userId = extractUserId(request)
    const pineconeIndex = getPineconeIndex()

    // Get document count
    const documentQuery = await pineconeIndex.query({
      vector: new Array(1536).fill(0),
      topK: 1,
      includeMetadata: true,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "document" },
      },
    })

    const documentCount = documentQuery.matches.length

    // Get search count
    const searchQuery = await pineconeIndex.query({
      vector: new Array(1536).fill(0),
      topK: 1,
      includeMetadata: true,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "search_history" },
      },
    })

    const searchCount = searchQuery.matches.length

    // Get chat count
    const chatQuery = await pineconeIndex.query({
      vector: new Array(1536).fill(0),
      topK: 1,
      includeMetadata: true,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "conversation" },
      },
    })

    const chatCount = chatQuery.matches.length

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
