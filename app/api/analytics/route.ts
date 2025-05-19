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
import { getAnalyticsData } from "@/services/analytics-service"
import { handleApiRequest, extractUserId, createSuccessResponse } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const userId = extractUserId(request)
      console.log(`GET /api/analytics - Fetching analytics for user`, { userId })

      const analyticsData = await getAnalyticsData(userId)

      console.log(`GET /api/analytics - Successfully fetched analytics data`, {
        userId,
        documentCount: analyticsData.documentCount,
        searchCount: analyticsData.searchCount,
        chatCount: analyticsData.chatCount,
        chunkCount: analyticsData.chunkCount,
      })

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
      })
    }
  })
})
