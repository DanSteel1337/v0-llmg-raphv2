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

import { queryVectors } from "@/lib/pinecone-rest-client"
import { VECTOR_DIMENSION } from "@/lib/embedding-config"
import type { AnalyticsData } from "@/types"

// Maximum number of vectors to retrieve for counting
const MAX_VECTORS_PER_QUERY = 10000

/**
 * Gets analytics data for a user using a safe approach compatible with Pinecone Serverless
 */
export async function getAnalyticsData(userId: string): Promise<AnalyticsData> {
  console.log(`Getting analytics data for user ${userId}`)

  try {
    // Create a zero vector with the correct dimension for querying
    const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

    // Initialize counters
    let documentCount = 0
    let searchCount = 0
    let chatCount = 0
    let chunkCount = 0

    // Get document count using queryVectors instead of describeIndexStats
    try {
      const documentResponse = await queryVectors(zeroVector, MAX_VECTORS_PER_QUERY, true, {
        user_id: { $eq: userId },
        record_type: { $eq: "document" },
      })

      documentCount = documentResponse.matches?.length || 0
      console.log(`Document count for user ${userId}: ${documentCount}`)
    } catch (error) {
      console.warn(`Error getting document count for user ${userId}:`, error)
      // Continue with zero count as fallback
    }

    // Get search count using queryVectors
    try {
      const searchResponse = await queryVectors(zeroVector, MAX_VECTORS_PER_QUERY, true, {
        user_id: { $eq: userId },
        record_type: { $eq: "search_history" },
      })

      searchCount = searchResponse.matches?.length || 0
      console.log(`Search count for user ${userId}: ${searchCount}`)
    } catch (error) {
      console.warn(`Error getting search count for user ${userId}:`, error)
      // Continue with zero count as fallback
    }

    // Get chat count using queryVectors
    try {
      const chatResponse = await queryVectors(zeroVector, MAX_VECTORS_PER_QUERY, true, {
        user_id: { $eq: userId },
        record_type: { $eq: "conversation" },
      })

      chatCount = chatResponse.matches?.length || 0
      console.log(`Chat count for user ${userId}: ${chatCount}`)
    } catch (error) {
      console.warn(`Error getting chat count for user ${userId}:`, error)
      // Continue with zero count as fallback
    }

    // Get chunk count using queryVectors
    try {
      const chunkResponse = await queryVectors(zeroVector, MAX_VECTORS_PER_QUERY, true, {
        user_id: { $eq: userId },
        record_type: { $eq: "chunk" },
      })

      chunkCount = chunkResponse.matches?.length || 0
      console.log(`Chunk count for user ${userId}: ${chunkCount}`)
    } catch (error) {
      console.warn(`Error getting chunk count for user ${userId}:`, error)
      // Continue with zero count as fallback
    }

    // Add a warning log if any count is equal to MAX_VECTORS_PER_QUERY
    // This indicates we might be hitting the topK limit
    if (
      documentCount === MAX_VECTORS_PER_QUERY ||
      searchCount === MAX_VECTORS_PER_QUERY ||
      chatCount === MAX_VECTORS_PER_QUERY ||
      chunkCount === MAX_VECTORS_PER_QUERY
    ) {
      console.warn(`One or more counts may be truncated due to reaching the query limit of ${MAX_VECTORS_PER_QUERY}`)
    }

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

    // Return fallback data with zeros instead of throwing
    return {
      documentCount: 0,
      searchCount: 0,
      chatCount: 0,
      chunkCount: 0,
      topDocuments: [],
      topSearches: [],
    }
  }
}
