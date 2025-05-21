/**
 * Embeddings API Route
 *
 * API endpoint for generating embeddings with the correct model.
 * Supports both single text and batch text embedding generation.
 *
 * Dependencies:
 * - @/lib/embedding-service.ts for embeddings
 * - @/lib/embedding-config.ts for model configuration
 * - @/utils/apiRequest.ts for standardized API responses
 * - @/utils/errorHandling.ts for error handling
 * - @/lib/utils/logger.ts for logging
 */

import type { NextRequest } from "next/server"
import { generateEmbedding, generateEmbeddings } from "@/lib/embedding-service"
import { EMBEDDING_MODEL, VECTOR_DIMENSION } from "@/lib/embedding-config"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { logger } from "@/lib/utils/logger"

// Edge runtime configuration
export const runtime = "edge"
export const dynamic = "force-dynamic"

// Constants for validation
const MAX_TEXT_LENGTH = 10 * 1024 * 1024 // 10MB
const MAX_BATCH_SIZE = 100
const MIN_TEXT_LENGTH = 1

/**
 * Validates text input for embedding generation
 * @param text - Text to validate
 * @throws Error if text is invalid
 */
function validateText(text: unknown): asserts text is string {
  if (typeof text !== "string") {
    throw new Error("Text must be a string")
  }

  if (text.length < MIN_TEXT_LENGTH) {
    throw new Error("Text cannot be empty")
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text exceeds maximum length of ${MAX_TEXT_LENGTH / 1024 / 1024}MB`)
  }
}

/**
 * Validates an array of texts for batch embedding generation
 * @param texts - Array of texts to validate
 * @throws Error if texts are invalid
 */
function validateTexts(texts: unknown): asserts texts is string[] {
  if (!Array.isArray(texts)) {
    throw new Error("Texts must be an array")
  }

  if (texts.length === 0) {
    throw new Error("Texts array cannot be empty")
  }

  if (texts.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size exceeds maximum of ${MAX_BATCH_SIZE} texts`)
  }

  // Validate each text in the array
  let totalLength = 0
  for (const text of texts) {
    if (typeof text !== "string") {
      throw new Error("All texts must be strings")
    }

    if (text.length < MIN_TEXT_LENGTH) {
      throw new Error("Texts cannot be empty")
    }

    totalLength += text.length
  }

  if (totalLength > MAX_TEXT_LENGTH) {
    throw new Error(`Total text length exceeds maximum of ${MAX_TEXT_LENGTH / 1024 / 1024}MB`)
  }
}

/**
 * Extracts and validates user ID from request
 * @param request - Next.js request object
 * @returns User ID if present and valid
 * @throws Error if user ID is missing or invalid
 */
function extractUserId(request: NextRequest): string {
  // Try to get user ID from headers first, then from query parameters
  const userId = request.headers.get("x-user-id") || request.nextUrl.searchParams.get("userId")

  // User ID is optional for embedding generation if not restricted
  // Uncomment the following if you want to require user authentication
  /*
  if (!userId) {
    throw new Error("User ID is required")
  }
  */

  return userId || "anonymous"
}

/**
 * POST handler for embedding generation
 * Accepts both single text and batch text inputs
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      // Extract user ID for tracking/logging
      const userId = extractUserId(request)

      // Parse request body
      const body = await request.json()

      // Track request for usage monitoring
      const clientIp = request.headers.get("x-forwarded-for") || "unknown"
      logger.info(`Embedding request`, {
        userId,
        clientIp,
        timestamp: new Date().toISOString(),
      })

      // Check if this is a query embedding (optimized for search)
      const isQueryEmbedding = body.queryEmbedding === true

      // Handle single text embedding
      if (body.text !== undefined) {
        validateText(body.text)

        logger.info(`Generating single embedding`, {
          userId,
          textLength: body.text.length,
          model: EMBEDDING_MODEL,
          isQuery: isQueryEmbedding,
        })

        const embedding = await generateEmbedding(body.text, {
          useCache: true, // Enable caching for performance
          dimensions: VECTOR_DIMENSION,
          model: EMBEDDING_MODEL,
        })

        return {
          embedding,
          model: EMBEDDING_MODEL,
          dimensions: embedding.length,
          isQuery: isQueryEmbedding,
        }
      }

      // Handle batch text embedding
      if (body.texts !== undefined) {
        validateTexts(body.texts)

        logger.info(`Generating batch embeddings`, {
          userId,
          batchSize: body.texts.length,
          totalLength: body.texts.reduce((sum: number, text: string) => sum + text.length, 0),
          model: EMBEDDING_MODEL,
          isQuery: isQueryEmbedding,
        })

        const embeddings = await generateEmbeddings(body.texts, {
          useCache: true, // Enable caching for performance
          dimensions: VECTOR_DIMENSION,
          model: EMBEDDING_MODEL,
          batchSize: 20, // Process in smaller batches for stability
        })

        return {
          embeddings,
          model: EMBEDDING_MODEL,
          dimensions: VECTOR_DIMENSION,
          count: embeddings.length,
          isQuery: isQueryEmbedding,
        }
      }

      // If neither text nor texts is provided
      throw new Error("Request must include either 'text' or 'texts' field")
    } catch (error) {
      logger.error("Error generating embedding", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
