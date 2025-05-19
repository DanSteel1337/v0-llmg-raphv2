/**
 * API Health Check Route
 *
 * API endpoint for checking the health of Pinecone and OpenAI APIs.
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"
import { queryVectors } from "@/lib/pinecone-rest-client"
import { generateEmbedding } from "@/lib/embedding-service"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    console.log(`GET /api/debug/check-health - Checking API health`)

    // Check Pinecone API health
    let pineconeApiHealthy = false
    try {
      // Create a dummy vector for querying
      const dummyVector = new Array(1536).fill(0.001)

      // Query Pinecone with a minimal request
      const result = await queryVectors(dummyVector, 1, false, undefined, "metadata")

      // If we get a response without an error, the API is healthy
      pineconeApiHealthy = !result.error

      console.log(`Pinecone API health check:`, {
        healthy: pineconeApiHealthy,
        error: result.error ? result.errorMessage || "Unknown error" : null,
      })
    } catch (error) {
      console.error("Error checking Pinecone API health:", error)
      pineconeApiHealthy = false
    }

    // Check OpenAI API health
    let openaiApiHealthy = false
    try {
      // Generate an embedding for a simple test string
      const result = await generateEmbedding("API health check test")

      // If we get a non-empty embedding, the API is healthy
      openaiApiHealthy = Array.isArray(result) && result.length > 0

      console.log(`OpenAI API health check:`, {
        healthy: openaiApiHealthy,
        embeddingLength: Array.isArray(result) ? result.length : 0,
      })
    } catch (error) {
      console.error("Error checking OpenAI API health:", error)
      openaiApiHealthy = false
    }

    return {
      pineconeApiHealthy,
      openaiApiHealthy,
      timestamp: new Date().toISOString(),
    }
  })
})
