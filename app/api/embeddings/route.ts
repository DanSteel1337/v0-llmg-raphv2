/**
 * Embeddings API Route
 *
 * API endpoint for generating embeddings with the correct model.
 *
 * Dependencies:
 * - @/lib/embedding-service.ts for embeddings
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/errorHandling for error handling
 */

import type { NextRequest } from "next/server"
import { generateEmbedding } from "@/lib/embedding-service"
import { EMBEDDING_MODEL, VECTOR_DIMENSION } from "@/lib/embedding-config"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { text } = await request.json()

      if (!text) {
        throw new Error("Text is required")
      }

      if (text.trim() === "") {
        throw new Error("Cannot generate embedding for empty or whitespace-only text")
      }

      logger.info(`Generating embedding`, {
        textLength: text.length,
        model: EMBEDDING_MODEL,
        expectedDimension: VECTOR_DIMENSION,
      })

      const embedding = await generateEmbedding(text)

      // Double-check that embedding dimensions match expected
      if (embedding.length !== VECTOR_DIMENSION) {
        throw new Error(`Embedding dimension mismatch: Expected ${VECTOR_DIMENSION}, got ${embedding.length}`)
      }

      // Double-check that embedding is not all zeros
      if (embedding.every((v) => v === 0)) {
        logger.error(`Generated an all-zero embedding`, {
          textSample: text.substring(0, 100) + "...",
          textLength: text.length,
        })
        throw new Error("Invalid embedding generated: vector contains only zeros")
      }

      logger.info(`Successfully generated embedding`, {
        dimensions: embedding.length,
      })

      return {
        embedding,
        model: EMBEDDING_MODEL,
        dimensions: embedding.length,
      }
    } catch (error) {
      logger.error("Error generating embedding", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
