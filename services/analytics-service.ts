/**
 * Analytics Service
 *
 * Handles analytics functionality using Pinecone metadata.
 * This service is responsible for retrieving analytics data
 * based on record types and user IDs stored in Pinecone.
 *
 * Dependencies:
 * - @/lib/pinecone-rest-client.ts for vector database access
 */

import { getIndexStats } from "@/lib/pinecone-rest-client"
import type { AnalyticsData } from "@/types"

/**
 * Gets analytics data for a user
 */
export async function getAnalyticsData(userId: string): Promise<AnalyticsData> {
  console.log(`Getting analytics data for user ${userId}`)

  try {
    // Get document count from Pinecone
    const documentStats = await getIndexStats({
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "document" },
      },
    })

    const documentCount = documentStats.namespaces?.[""]?.vectorCount || 0
    console.log(`Document count for user ${userId}: ${documentCount}`)

    // Get search count from Pinecone
    const searchStats = await getIndexStats({
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "search_history" },
      },
    })

    const searchCount = searchStats.namespaces?.[""]?.vectorCount || 0
    console.log(`Search count for user ${userId}: ${searchCount}`)

    // Get chat count from Pinecone
    const chatStats = await getIndexStats({
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "conversation" },
      },
    })

    const chatCount = chatStats.namespaces?.[""]?.vectorCount || 0
    console.log(`Chat count for user ${userId}: ${chatCount}`)

    // Get chunk count from Pinecone
    const chunkStats = await getIndexStats({
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "chunk" },
      },
    })

    const chunkCount = chunkStats.namespaces?.[""]?.vectorCount || 0
    console.log(`Chunk count for user ${userId}: ${chunkCount}`)

    // Construct analytics data
    const analyticsData: AnalyticsData = {
      documentCount,
      searchCount,
      chatCount,
      chunkCount,
      topDocuments: [],
      topSearches: [],
    }

    console.log(`Successfully retrieved analytics data for user ${userId}`)
    return analyticsData
  } catch (error) {
    console.error(`Error getting analytics data for user ${userId}:`, error)
    throw error
  }
}
