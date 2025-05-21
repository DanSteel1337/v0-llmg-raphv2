/**
 * Pinecone Client for Serverless (Edge Runtime)
 *
 * Server-only singleton implementation for Pinecone v0.5.2+ vector database.
 * Provides a consistent interface for vector operations in Edge Runtime.
 *
 * IMPORTANT:
 * - This file is server-only and should not be imported in client components
 * - Uses singleton pattern compatible with Edge Runtime
 * - Implements retry logic for resilience against rate limits
 * - Validates environment variables before use
 * - Compatible with text-embedding-3-large (3072 dimensions)
 *
 * @module lib/pinecone-client
 */

// Mark as server-only
// 'use server' - Not using this directive as it's not needed in lib files

import { VECTOR_DIMENSION, EMBEDDING_MODEL } from "./embedding-config"
import { logger } from "./utils/logger"

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
    metadata?: Record<string, any>
  }>
  namespace?: string
}

// Singleton instance
let pineconeClient: any = null
let pineconeIndex: any = null

/**
 * Validates required environment variables for Pinecone
 * @throws Error if any required environment variable is missing
 */
function validateEnv(): void {
  const requiredVars = ["PINECONE_API_KEY", "PINECONE_INDEX_NAME", "PINECONE_ENVIRONMENT"]

  const missing = requiredVars.filter((varName) => !process.env[varName])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }
}

/**
 * Gets or initializes the Pinecone client
 * Uses singleton pattern to avoid recreating the client on each request
 *
 * @returns Initialized Pinecone client
 */
export async function getPineconeClient() {
  // Only initialize once
  if (!pineconeClient) {
    try {
      validateEnv()

      const apiKey = process.env.PINECONE_API_KEY!
      const environment = process.env.PINECONE_ENVIRONMENT!

      // Using REST client approach for Edge compatibility
      pineconeClient = {
        apiKey,
        environment,
        baseUrl: `https://${environment}.pinecone.io`,
      }

      logger.info("Initialized Pinecone client", {
        environment,
      })
    } catch (error) {
      logger.error("Failed to initialize Pinecone client", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  return pineconeClient
}

/**
 * Gets or initializes the Pinecone index
 *
 * @returns Initialized Pinecone index
 */
export async function getPineconeIndex() {
  if (!pineconeIndex) {
    try {
      const client = await getPineconeClient()
      const indexName = process.env.PINECONE_INDEX_NAME!

      // Create a reference to the index
      pineconeIndex = {
        ...client,
        indexName,
        indexUrl: `https://${indexName}-${client.environment}.svc.${client.environment}.pinecone.io`,
      }

      logger.info("Initialized Pinecone index", {
        indexName,
      })
    } catch (error) {
      logger.error("Failed to initialize Pinecone index", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  return pineconeIndex
}

/**
 * Implements exponential backoff retry logic for Pinecone operations
 *
 * @param operation - Async function to retry
 * @param maxRetries - Maximum number of retry attempts
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
 * Query Pinecone with retry logic
 *
 * @param vector - Query vector
 * @param topK - Maximum number of results
 * @param filter - Optional filter criteria
 * @param namespace - Optional namespace
 * @returns Query results
 */
export async function queryPineconeWithRetry(
  vector: number[],
  topK = 5,
  filter?: PineconeFilter,
  namespace = "",
): Promise<QueryResponse> {
  return withRetry(async () => {
    const index = await getPineconeIndex()

    // Validate vector dimensions
    if (vector.length !== VECTOR_DIMENSION) {
      throw new Error(
        `Vector dimension mismatch: Expected ${VECTOR_DIMENSION}, got ${vector.length}. ` +
          `Make sure you're using the correct embedding model (${EMBEDDING_MODEL}).`,
      )
    }

    const response = await fetch(`${index.indexUrl}/query`, {
      method: "POST",
      headers: {
        "Api-Key": index.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vector,
        topK,
        includeMetadata: true,
        namespace,
        filter,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error: any = new Error(`Pinecone query failed: ${response.status} ${response.statusText} - ${errorText}`)
      error.status = response.status
      throw error
    }

    return await response.json()
  })
}

/**
 * Upsert vectors to Pinecone with retry logic
 *
 * @param vectors - Array of vectors to insert/update
 * @param namespace - Optional namespace
 * @returns Upsert result
 */
export async function upsertVectorsWithRetry(
  vectors: PineconeRecord[],
  namespace = "",
): Promise<{ upsertedCount: number }> {
  // Process in batches of 100
  const BATCH_SIZE = 100
  let totalUpserted = 0

  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE)

    await withRetry(async () => {
      const index = await getPineconeIndex()

      const response = await fetch(`${index.indexUrl}/vectors/upsert`, {
        method: "POST",
        headers: {
          "Api-Key": index.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vectors: batch,
          namespace,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        const error: any = new Error(`Pinecone upsert failed: ${response.status} ${response.statusText} - ${errorText}`)
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

      return result
    })
  }

  return { upsertedCount: totalUpserted }
}

/**
 * Delete vectors from Pinecone with retry logic
 *
 * @param ids - Array of vector IDs to delete
 * @param namespace - Optional namespace
 * @returns Delete result
 */
export async function deleteVectorsWithRetry(ids: string[], namespace = ""): Promise<{ deletedCount: number }> {
  return withRetry(async () => {
    const index = await getPineconeIndex()

    const response = await fetch(`${index.indexUrl}/vectors/delete`, {
      method: "POST",
      headers: {
        "Api-Key": index.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids,
        namespace,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error: any = new Error(`Pinecone delete failed: ${response.status} ${response.statusText} - ${errorText}`)
      error.status = response.status
      throw error
    }

    const result = await response.json()

    logger.info(`Successfully deleted vectors`, {
      deletedCount: ids.length,
      namespace: namespace || "default",
    })

    return { deletedCount: ids.length }
  })
}

/**
 * Check Pinecone health
 *
 * @returns Health check result
 */
export async function healthCheck(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const index = await getPineconeIndex()

    // Create a minimal query to check connectivity
    const dummyVector = Array(VECTOR_DIMENSION)
      .fill(0)
      .map(() => Math.random() * 0.001)

    const response = await fetch(`${index.indexUrl}/query`, {
      method: "POST",
      headers: {
        "Api-Key": index.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vector: dummyVector,
        topK: 1,
        includeMetadata: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        healthy: false,
        error: `Health check failed: ${response.status} ${response.statusText} - ${errorText}`,
      }
    }

    return { healthy: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      healthy: false,
      error: `Health check exception: ${errorMessage}`,
    }
  }
}
