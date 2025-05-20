/**
 * Pinecone REST Client for Serverless
 * 
 * Provides a standardized interface for interacting with Pinecone Serverless vector database.
 * Implements retry logic, error handling, and validation to ensure reliable operations.
 * 
 * Key Features:
 * - Singleton pattern for client management
 * - Exponential backoff retry for rate limits and transient errors
 * - Vector validation to prevent invalid operations
 * - Batch processing with size limitations
 * 
 * @module lib/pinecone-rest-client
 */

import { VECTOR_DIMENSION } from "@/lib/embedding-config"
import { logger } from "@/lib/utils/logger"

// Singleton instance
let apiKey: string | null = null
let pineconeHost: string | null = null

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
 * @param url - API endpoint URL
 * @param options - Request options
 * @param retries - Maximum retry attempts
 * @param backoff - Initial backoff time in ms
 * @returns Fetch response
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 300): Promise<Response> {
  try {
    const response = await fetch(url, options)

    // If rate limited or service unavailable, retry with backoff
    if (response.status === 429 || response.status === 503) {
      if (retries === 0) throw new Error(`Max retries reached: ${response.status} ${response.statusText}`)

      // Use Retry-After header if available, or exponential backoff
      const retryAfter = response.headers.get("Retry-After")
      const waitTime = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : backoff

      logger.warn(`Rate limited (${response.status}). Retrying in ${waitTime}ms. Retries left: ${retries}`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))

      return fetchWithRetry(url, options, retries - 1, backoff * 2)
    }

    return response
  } catch (error) {
    if (retries === 0) throw error

    logger.warn(`Network error. Retrying in ${backoff}ms. Retries left: ${retries}`)
    await new Promise((resolve) => setTimeout(resolve, backoff))

    return fetchWithRetry(url, options, retries - 1, backoff * 2)
  }
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
export async function upsertVectors(vectors: any[], namespace = ""): Promise<{ upsertedCount: number }> {
  logger.info(`Upserting ${vectors.length} vectors to Pinecone`, {
    namespace: namespace || "default",
    vectorCount: vectors.length,
  })

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
      const batch = Array.isArray(validVectors) ? validVectors.slice(i, i + BATCH_SIZE) : []

      const response = await fetchWithRetry(`${host}/vectors/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
        body: JSON.stringify({ vectors: batch, namespace }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`Upsert failed: ${response.status} - ${errorText}`, {
          host,
          namespace,
          batchSize: batch.length,
        })
        throw new Error(`Upsert failed: ${response.status} ${response.statusText} - ${errorText}`)
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
  filter?: Record<string, any>,
  namespace = "",
) {
  logger.info(`Querying Pinecone`, {
    topK,
    filter: filter ? JSON.stringify(filter).substring(0, 100) + "..." : "none",
    namespace: namespace || "default",
  })

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

    const response = await fetchWithRetry(`${host}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify(queryBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`Query error: Status ${response.status}`, {
        statusText: response.statusText,
        error: errorText,
        host,
      })

      // Return empty matches instead of throwing to provide fallback behavior
      return { matches: [], error: true, status: response.status }
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
}

/**
 * Delete vectors from Pinecone
 * 
 * @param ids - Array of vector IDs to delete
 * @param namespace - Optional namespace (default: "")
 * @returns Delete result
 */
export async function deleteVectors(ids: string[], namespace = "") {
  logger.info(`Deleting ${ids.length} vectors from Pinecone`, {
    namespace: namespace || "default",
  })

  try {
    const { apiKey, host } = getPineconeClient()

    // Ensure ids is an array before proceeding
    const safeIds = Array.isArray(ids) ? ids : []

    if (safeIds.length === 0) {
      logger.warn("No valid IDs to delete")
      return { deletedCount: 0 }
    }

    const response = await fetchWithRetry(`${host}/vectors/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({ ids: safeIds, namespace }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`Delete failed: ${response.status} - ${errorText}`, { host })
      throw new Error(`Delete failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    logger.info(`Successfully deleted vectors`, {
      deletedCount: safeIds.length,
      namespace: namespace || "default",
      result,
    })
    return result
  } catch (error) {
    logger.error("Delete exception:", error)
    throw error
  }
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
