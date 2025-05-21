/**
 * Pinecone Client for Serverless
 *
 * Provides a standardized interface for interacting with Pinecone Serverless vector database.
 * Implements retry logic, error handling, and validation to ensure reliable operations.
 *
 * IMPORTANT:
 * - Always use createPlaceholderVector() for placeholders, never zero vectors
 * - Document IDs should not have prefixes when stored in Pinecone
 * - All vector operations must be Edge-compatible
 * - Always implement retry logic for rate limits
 * - Always validate vectors before sending to Pinecone
 *
 * Dependencies:
 * - @/lib/embedding-config for vector dimensions
 * - @/lib/utils/logger for structured logging
 *
 * @module lib/pinecone-client
 */

import { VECTOR_DIMENSION } from "@/lib/embedding-config"
import { logger } from "@/lib/utils/logger"

// Singleton instance
let apiKey: string | null = null
let pineconeHost: string | null = null

// Types for Pinecone operations
export interface PineconeRecord {
  id: string
  values: number[]
  metadata?: Record<string, any>
}

export interface PineconeFilter {
  [key: string]: any
}

export interface QueryResponse {
  matches: Array<{
    id: string
    score: number
    values?: number[]
    metadata?: Record<string, any>
  }>
  namespace?: string
  usage?: {
    readUnits: number
  }
}

/**
 * Gets the Pinecone client configuration
 * Uses singleton pattern to avoid recreating the client on each request
 *
 * @returns Client configuration with API key and host
 * @throws Error if environment variables are not configured correctly
 */
export function getPineconeClient() {
  if (!apiKey) {
    apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not defined")
    }
  }

  if (!pineconeHost) {
    // First try PINECONE_HOST, then fall back to PINECONE_ENVIRONMENT
    pineconeHost = process.env.PINECONE_HOST || process.env.PINECONE_ENVIRONMENT

    if (!pineconeHost) {
      throw new Error(
        "PINECONE_HOST or PINECONE_ENVIRONMENT is not defined. For Serverless indexes, you must set the exact host URL from the Pinecone console.",
      )
    }

    // Ensure the host URL is properly formatted
    if (!pineconeHost.startsWith("https://")) {
      pineconeHost = `https://${pineconeHost}`
    }

    // Log the host URL for debugging (safely)
    logger.info(`Initialized Pinecone client with host: ${pineconeHost}`)
  }

  return { apiKey, host: pineconeHost }
}

/**
 * Validates vector dimensions against the expected dimension
 *
 * @param vector - Vector to validate
 * @throws Error if vector is invalid
 */
export function validateVectorDimension(vector: number[]): void {
  if (!vector || !Array.isArray(vector)) {
    throw new Error(`Invalid vector: expected array, got ${typeof vector}`)
  }

  if (vector.length !== VECTOR_DIMENSION) {
    throw new Error(
      `Vector dimension mismatch: Expected ${VECTOR_DIMENSION}, got ${vector.length}. ` +
        `Make sure you're using the correct embedding model (text-embedding-3-large).`,
    )
  }

  // Check if vector is all zeros
  if (vector.every((v) => v === 0)) {
    throw new Error("Invalid vector: contains only zeros")
  }
}

/**
 * Implements exponential backoff retry logic for API calls
 *
 * @param operation - Async function to retry
 * @param maxRetries - Maximum retry attempts
 * @param initialBackoff - Initial backoff time in ms
 * @returns Result of the operation
 */
export async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, initialBackoff = 300): Promise<T> {
  let retries = 0
  let lastError: any = null

  while (retries <= maxRetries) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error

      // Check if error is rate limiting or service unavailable
      const isRateLimited =
        error.status === 429 ||
        error.status === 503 ||
        error.message?.includes("rate limit") ||
        error.message?.includes("too many requests")

      if (!isRateLimited && retries === maxRetries) {
        throw error
      }

      // Calculate backoff with exponential increase and jitter
      const backoff = initialBackoff * Math.pow(2, retries) * (0.8 + Math.random() * 0.4)

      logger.warn(`Pinecone operation failed, retrying in ${backoff.toFixed(0)}ms`, {
        retryCount: retries + 1,
        maxRetries,
        error: error instanceof Error ? error.message : String(error),
      })

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, backoff))
      retries++
    }
  }

  // If we've exhausted retries, throw the last error
  throw lastError
}

/**
 * Creates a placeholder vector with small non-zero values
 * This prevents Pinecone from rejecting the vector for being all zeros
 *
 * @returns Non-zero vector with correct dimensions
 */
export function createPlaceholderVector(): number[] {
  // Create a vector with small random values instead of zeros
  return Array(VECTOR_DIMENSION)
    .fill(0)
    .map(() => Math.random() * 0.001 + 0.0001) // Ensure values are never exactly zero
}

/**
 * Upsert vectors to Pinecone
 *
 * @param vectors - Array of vectors to insert/update
 * @param namespace - Optional namespace (default: "")
 * @returns Upsert result with count
 */
export async function upsertVectors(vectors: PineconeRecord[], namespace = ""): Promise<{ upsertedCount: number }> {
  logger.info(`Upserting ${vectors.length} vectors to Pinecone`, {
    namespace: namespace || "default",
    vectorCount: vectors.length,
  })

  return withRetry(async () => {
    try {
      const { apiKey, host } = getPineconeClient()

      // Filter out invalid vectors
      const validVectors = vectors.filter((vector) => {
        if (!vector.values || !Array.isArray(vector.values)) {
          logger.error("Rejecting vector with missing or invalid values array", {
            vectorId: vector.id,
          })
          return false
        }

        try {
          // Validate vector dimension
          validateVectorDimension(vector.values)
          return true
        } catch (error) {
          logger.error("Rejecting invalid vector", {
            vectorId: vector.id,
            error: error instanceof Error ? error.message : "Unknown error",
          })
          return false
        }
      })

      // If no valid vectors remain, return early
      if (validVectors.length === 0) {
        logger.warn("No valid vectors to upsert")
        return { upsertedCount: 0 }
      }

      // Process in batches of 100
      const BATCH_SIZE = 100
      let totalUpserted = 0

      for (let i = 0; i < validVectors.length; i += BATCH_SIZE) {
        const batch = validVectors.slice(i, i + BATCH_SIZE)

        const response = await fetch(`${host}/vectors/upsert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": apiKey,
          },
          body: JSON.stringify({ vectors: batch, namespace }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          const error: any = new Error(`Upsert failed: ${response.status} ${response.statusText} - ${errorText}`)
          error.status = response.status
          throw error
        }

        const result = await response.json()
        totalUpserted += batch.length

        logger.info(`Successfully upserted batch of vectors`, {
          batchSize: batch.length,
          totalUpserted,
          namespace: namespace || "default",
        })
      }

      return { upsertedCount: totalUpserted }
    } catch (error) {
      logger.error("Upsert exception:", error)
      throw error
    }
  })
}

/**
 * Query vectors from Pinecone
 *
 * @param vector - Query vector
 * @param topK - Maximum number of results
 * @param includeMetadata - Whether to include metadata
 * @param filter - Optional filter criteria
 * @param namespace - Optional namespace (default: "")
 * @returns Query results
 */
export async function queryVectors(
  vector: number[],
  topK = 5,
  includeMetadata = true,
  filter?: PineconeFilter,
  namespace = "",
): Promise<QueryResponse> {
  logger.info(`Querying Pinecone`, {
    topK,
    filter: filter ? JSON.stringify(filter).substring(0, 100) + "..." : "none",
    namespace: namespace || "default",
  })

  return withRetry(async () => {
    try {
      const { apiKey, host } = getPineconeClient()

      // Validate query vector dimension
      try {
        validateVectorDimension(vector)
      } catch (error) {
        // If vector validation fails, use a placeholder vector for metadata-only queries
        logger.warn(`Vector validation failed, using placeholder vector: ${error.message}`)
        vector = createPlaceholderVector()
      }

      const queryBody: any = {
        vector,
        topK,
        includeMetadata,
        namespace,
      }

      if (filter) {
        queryBody.filter = filter
      }

      const response = await fetch(`${host}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
        body: JSON.stringify(queryBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        const error: any = new Error(`Query error: Status ${response.status} - ${errorText}`)
        error.status = response.status
        throw error
      }

      const result = await response.json()
      logger.info(`Query successful`, {
        matchCount: result.matches?.length || 0,
        namespace: namespace || "default",
      })
      return result
    } catch (error) {
      logger.error("Query exception:", error)
      // Return empty matches instead of throwing to provide fallback behavior
      return { matches: [], error: true, errorMessage: error instanceof Error ? error.message : String(error) }
    }
  })
}

/**
 * Delete vectors from Pinecone
 *
 * @param ids - Array of vector IDs to delete
 * @param namespace - Optional namespace (default: "")
 * @returns Delete result
 */
export async function deleteVectors(ids: string[], namespace = ""): Promise<{ deletedCount: number }> {
  logger.info(`Deleting ${ids.length} vectors from Pinecone`, {
    namespace: namespace || "default",
  })

  return withRetry(async () => {
    try {
      const { apiKey, host } = getPineconeClient()

      // Ensure ids is an array before proceeding
      const safeIds = Array.isArray(ids) ? ids : []

      if (safeIds.length === 0) {
        logger.warn("No valid IDs to delete")
        return { deletedCount: 0 }
      }

      const response = await fetch(`${host}/vectors/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
        body: JSON.stringify({ ids: safeIds, namespace }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        const error: any = new Error(`Delete failed: ${response.status} ${response.statusText} - ${errorText}`)
        error.status = response.status
        throw error
      }

      const result = await response.json()
      logger.info(`Successfully deleted vectors`, {
        deletedCount: safeIds.length,
        namespace: namespace || "default",
        result,
      })
      return { deletedCount: safeIds.length }
    } catch (error) {
      logger.error("Delete exception:", error)
      throw error
    }
  })
}

/**
 * Create a health check query to verify Pinecone connectivity
 *
 * @returns Health check result
 */
export async function healthCheck(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const { apiKey, host } = getPineconeClient()

    // Log the host for debugging (safely)
    logger.info(`Performing health check with host: ${host}`)

    // Create a minimal vector for the health check
    const dummyVector = createPlaceholderVector()

    // Make a minimal query to check connectivity
    const response = await fetch(`${host}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({
        vector: dummyVector,
        topK: 1,
        includeMetadata: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`Health check failed: ${response.status} - ${errorText}`, { host })
      return {
        healthy: false,
        error: `Health check failed: ${response.status} ${response.statusText} - ${errorText}`,
      }
    }

    return { healthy: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("Health check exception:", { error: errorMessage })
    return {
      healthy: false,
      error: `Health check exception: ${errorMessage}`,
    }
  }
}
