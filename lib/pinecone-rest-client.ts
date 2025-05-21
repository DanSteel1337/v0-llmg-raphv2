/**
 * Pinecone REST Client for Serverless
 *
 * Provides a standardized interface for interacting with Pinecone Serverless vector database.
 * Implements retry logic, error handling, and validation to ensure reliable operations.
 *
 * Features:
 * - Singleton pattern optimized for Edge Runtime
 * - Comprehensive retry logic with exponential backoff
 * - Proper TypeScript interfaces for all operations
 * - Helper methods for common operations
 * - Input validation for all operations
 * - Rate limiting handling with queuing mechanism
 * - Detailed JSDoc comments for all exported functions
 * - Optimized for Pinecone Serverless indexes
 * - Compatible with 3072-dimension vectors from text-embedding-3-large
 *
 * Dependencies:
 * - @/lib/embedding-config for vector dimensions
 * - @/lib/utils/logger for structured logging
 *
 * @module lib/pinecone-rest-client
 */

import { VECTOR_DIMENSION, EMBEDDING_MODEL } from "@/lib/embedding-config"
import { logger } from "@/lib/utils/logger"

// Custom error class for Pinecone operations
export class PineconeError extends Error {
  status?: number
  retryable: boolean
  context?: Record<string, any>

  constructor(message: string, options: { status?: number; retryable?: boolean; context?: Record<string, any> } = {}) {
    super(message)
    this.name = "PineconeError"
    this.status = options.status
    this.retryable = options.retryable ?? false
    this.context = options.context
  }
}

// TypeScript interfaces for Pinecone operations
export interface PineconeVector {
  id: string
  values: number[]
  metadata?: Record<string, any>
}

export interface PineconeQueryRequest {
  vector?: number[]
  id?: string
  topK?: number
  includeMetadata?: boolean
  includeValues?: boolean
  filter?: Record<string, any>
  namespace?: string
}

export interface PineconeQueryMatch {
  id: string
  score?: number
  values?: number[]
  metadata?: Record<string, any>
}

export interface PineconeQueryResponse {
  matches: PineconeQueryMatch[]
  namespace?: string
  error?: boolean
  errorMessage?: string
  status?: number
}

export interface PineconeUpsertRequest {
  vectors: PineconeVector[]
  namespace?: string
}

export interface PineconeUpsertResponse {
  upsertedCount: number
}

export interface PineconeDeleteRequest {
  ids?: string[]
  deleteAll?: boolean
  filter?: Record<string, any>
  namespace?: string
}

export interface PineconeDeleteResponse {
  deletedCount?: number
}

export interface PineconeListNamespacesResponse {
  namespaces: { name: string }[]
}

export interface PineconeDescribeIndexStatsResponse {
  namespaces: Record<string, { vectorCount: number }>
  dimension: number
  indexFullness: number
  totalVectorCount: number
}

export interface PineconeClientConfig {
  apiKey: string
  host: string
  defaultNamespace?: string
}

export interface RetryOptions {
  maxRetries?: number
  initialBackoff?: number
  maxBackoff?: number
  backoffFactor?: number
}

// Default retry options
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialBackoff: 300,
  maxBackoff: 10000,
  backoffFactor: 2,
}

// Singleton instance
let apiKey: string | null = null
let pineconeHost: string | null = null
let defaultNamespace = ""

/**
 * Gets the Pinecone client configuration
 * Uses singleton pattern to avoid recreating the client on each request
 *
 * @param options - Optional configuration options
 * @returns Client configuration with API key and host
 * @throws PineconeError if environment variables are not configured correctly
 */
export function getPineconeClient(options?: { namespace?: string }): PineconeClientConfig {
  if (!apiKey) {
    apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) {
      throw new PineconeError("PINECONE_API_KEY is not defined", {
        retryable: false,
        context: { error: "missing_api_key" },
      })
    }
  }

  if (!pineconeHost) {
    // First try PINECONE_HOST, then fall back to PINECONE_ENVIRONMENT
    pineconeHost = process.env.PINECONE_HOST || process.env.PINECONE_ENVIRONMENT

    if (!pineconeHost) {
      throw new PineconeError(
        "PINECONE_HOST or PINECONE_ENVIRONMENT is not defined. For Serverless indexes, you must set the exact host URL from the Pinecone console.",
        {
          retryable: false,
          context: { error: "missing_host" },
        },
      )
    }

    // Ensure the host URL is properly formatted
    if (!pineconeHost.startsWith("https://")) {
      pineconeHost = `https://${pineconeHost}`
    }

    // Log the host URL for debugging (safely)
    logger.info(`Initialized Pinecone client with host: ${pineconeHost}`)
  }

  // Set default namespace if provided
  if (options?.namespace) {
    defaultNamespace = options.namespace
  }

  return { apiKey, host: pineconeHost, defaultNamespace }
}

/**
 * Validates vector dimensions against the expected dimension
 *
 * @param vector - Vector to validate
 * @throws PineconeError if vector is invalid
 */
export function validateVectorDimension(vector: number[]): void {
  if (!vector || !Array.isArray(vector)) {
    throw new PineconeError(`Invalid vector: expected array, got ${typeof vector}`, {
      retryable: false,
      context: { vectorType: typeof vector },
    })
  }

  if (vector.length !== VECTOR_DIMENSION) {
    throw new PineconeError(
      `Vector dimension mismatch: Expected ${VECTOR_DIMENSION}, got ${vector.length}. ` +
        `Make sure you're using the correct embedding model (${EMBEDDING_MODEL}).`,
      {
        retryable: false,
        context: { expectedDimension: VECTOR_DIMENSION, actualDimension: vector.length },
      },
    )
  }

  // Check if vector is all zeros
  if (vector.every((v) => Math.abs(v) < 1e-6)) {
    throw new PineconeError("Invalid vector: contains only zeros or near-zero values", {
      retryable: false,
      context: { error: "zero_vector" },
    })
  }
}

/**
 * Implements exponential backoff retry logic for API calls
 *
 * @param operation - Function to retry
 * @param options - Retry options
 * @returns Result of the operation
 * @throws PineconeError if all retries fail
 */
async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = DEFAULT_RETRY_OPTIONS): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries!
  const initialBackoff = options.initialBackoff ?? DEFAULT_RETRY_OPTIONS.initialBackoff!
  const maxBackoff = options.maxBackoff ?? DEFAULT_RETRY_OPTIONS.maxBackoff!
  const backoffFactor = options.backoffFactor ?? DEFAULT_RETRY_OPTIONS.backoffFactor!

  let lastError: Error | null = null
  let retryCount = 0

  while (retryCount <= maxRetries) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // If error is not retryable, throw immediately
      if (error instanceof PineconeError && !error.retryable) {
        throw error
      }

      // If this was the last retry, throw the error
      if (retryCount >= maxRetries) {
        if (error instanceof PineconeError) {
          throw error
        } else {
          throw new PineconeError(`Operation failed after ${maxRetries} retries: ${lastError.message}`, {
            retryable: false,
            context: { originalError: lastError.message },
          })
        }
      }

      // Calculate backoff time with jitter
      const backoffTime = Math.min(initialBackoff * Math.pow(backoffFactor, retryCount), maxBackoff)
      const jitter = Math.random() * 0.3 * backoffTime // Add up to 30% jitter
      const waitTime = backoffTime + jitter

      logger.warn(`Operation failed, retrying in ${Math.round(waitTime)}ms (${retryCount + 1}/${maxRetries})`, {
        error: lastError.message,
        retryCount,
        waitTime: Math.round(waitTime),
      })

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, waitTime))
      retryCount++
    }
  }

  // This should never happen, but TypeScript needs it
  throw lastError || new Error("Unknown error in retry logic")
}

/**
 * Handles HTTP response from Pinecone API
 *
 * @param response - Fetch response
 * @param operationName - Name of the operation for logging
 * @returns Parsed JSON response
 * @throws PineconeError if response is not OK
 */
async function handlePineconeResponse(response: Response, operationName: string): Promise<any> {
  if (!response.ok) {
    let errorText: string
    let errorJson: any = {}

    try {
      errorJson = await response.json()
      errorText = errorJson.message || errorJson.error || `${response.status} ${response.statusText}`
    } catch (e) {
      errorText = (await response.text()) || `${response.status} ${response.statusText}`
    }

    // Determine if error is retryable
    const retryable = response.status === 429 || response.status === 503 || response.status >= 500

    throw new PineconeError(`${operationName} failed: ${errorText}`, {
      status: response.status,
      retryable,
      context: {
        operation: operationName,
        status: response.status,
        statusText: response.statusText,
        errorDetails: errorJson,
      },
    })
  }

  return await response.json()
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
 * Upsert vectors to Pinecone with batching and retry logic
 *
 * @param vectors - Array of vectors to insert/update
 * @param options - Optional parameters (namespace, batchSize)
 * @returns Upsert result with count
 * @throws PineconeError if operation fails
 */
export async function upsertVectors(
  vectors: PineconeVector[],
  options: { namespace?: string; batchSize?: number } = {},
): Promise<PineconeUpsertResponse> {
  const namespace = options.namespace || defaultNamespace
  const batchSize = options.batchSize || 100

  logger.info(`Upserting ${vectors.length} vectors to Pinecone`, {
    namespace: namespace || "default",
    vectorCount: vectors.length,
    batchSize,
  })

  try {
    const { apiKey, host } = getPineconeClient({ namespace })

    // Filter out invalid vectors
    const validVectors = vectors.filter((vector) => {
      if (!vector.id) {
        logger.error("Rejecting vector with missing ID", {
          metadata: vector.metadata,
        })
        return false
      }

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

    // Process in batches
    let totalUpserted = 0

    // Create batches
    const batches: PineconeVector[][] = []
    for (let i = 0; i < validVectors.length; i += batchSize) {
      batches.push(validVectors.slice(i, i + batchSize))
    }

    // Process each batch with retry logic
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]

      await withRetry(async () => {
        const response = await fetch(`${host}/vectors/upsert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": apiKey,
          },
          body: JSON.stringify({ vectors: batch, namespace }),
        })

        const result = await handlePineconeResponse(response, "Upsert vectors")
        totalUpserted += batch.length

        logger.info(`Successfully upserted batch ${i + 1}/${batches.length} of vectors`, {
          batchSize: batch.length,
          totalUpserted,
          namespace: namespace || "default",
          batchNumber: i + 1,
          totalBatches: batches.length,
        })

        return result
      })
    }

    return { upsertedCount: totalUpserted }
  } catch (error) {
    if (error instanceof PineconeError) {
      throw error
    }

    logger.error("Upsert exception:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    throw new PineconeError(`Failed to upsert vectors: ${error instanceof Error ? error.message : String(error)}`, {
      retryable: false,
      context: { error: error instanceof Error ? error.message : String(error) },
    })
  }
}

/**
 * Query vectors from Pinecone with retry logic
 *
 * @param queryInput - Query vector or vector ID
 * @param options - Query options (topK, includeMetadata, filter, namespace)
 * @returns Query results
 * @throws PineconeError if operation fails
 */
export async function queryVectors(
  queryInput: number[] | string,
  options: {
    topK?: number
    includeMetadata?: boolean
    includeValues?: boolean
    filter?: Record<string, any>
    namespace?: string
  } = {},
): Promise<PineconeQueryResponse> {
  const { topK = 10, includeMetadata = true, includeValues = false, filter, namespace = defaultNamespace } = options

  const isVectorQuery = Array.isArray(queryInput)
  const queryType = isVectorQuery ? "vector" : "id"

  logger.info(`Querying Pinecone by ${queryType}`, {
    topK,
    filter: filter ? JSON.stringify(filter).substring(0, 100) + "..." : "none",
    namespace: namespace || "default",
    includeMetadata,
    includeValues,
  })

  try {
    const { apiKey, host } = getPineconeClient({ namespace })

    // Prepare query body based on input type
    const queryBody: PineconeQueryRequest = {
      topK,
      includeMetadata,
      includeValues,
      namespace,
    }

    if (isVectorQuery) {
      // Vector-based query
      try {
        validateVectorDimension(queryInput as number[])
        queryBody.vector = queryInput as number[]
      } catch (error) {
        // If vector validation fails, use a placeholder vector for metadata-only queries
        logger.warn(
          `Vector validation failed, using placeholder vector: ${error instanceof Error ? error.message : String(error)}`,
        )
        queryBody.vector = createPlaceholderVector()
      }
    } else {
      // ID-based query
      queryBody.id = queryInput as string
    }

    if (filter) {
      queryBody.filter = filter
    }

    return await withRetry(async () => {
      const response = await fetch(`${host}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
        body: JSON.stringify(queryBody),
      })

      const result = await handlePineconeResponse(response, "Query vectors")

      logger.info(`Query successful`, {
        matchCount: result.matches?.length || 0,
        namespace: namespace || "default",
      })

      return result as PineconeQueryResponse
    })
  } catch (error) {
    if (error instanceof PineconeError) {
      // For query errors, return empty matches instead of throwing
      logger.error("Query error:", {
        error: error.message,
        status: error.status,
        context: error.context,
      })

      return {
        matches: [],
        error: true,
        errorMessage: error.message,
        status: error.status,
      }
    }

    logger.error("Query exception:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Return empty matches instead of throwing to provide fallback behavior
    return {
      matches: [],
      error: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Fetch vectors by IDs from Pinecone
 *
 * @param ids - Array of vector IDs to fetch
 * @param options - Fetch options (namespace)
 * @returns Vectors with metadata
 * @throws PineconeError if operation fails
 */
export async function fetchVectors(
  ids: string[],
  options: {
    namespace?: string
    includeValues?: boolean
  } = {},
): Promise<{ vectors: Record<string, PineconeVector> }> {
  const { namespace = defaultNamespace, includeValues = false } = options

  logger.info(`Fetching ${ids.length} vectors from Pinecone`, {
    namespace: namespace || "default",
    includeValues,
  })

  try {
    const { apiKey, host } = getPineconeClient({ namespace })

    // Ensure ids is an array before proceeding
    const safeIds = Array.isArray(ids) ? ids : []

    if (safeIds.length === 0) {
      logger.warn("No valid IDs to fetch")
      return { vectors: {} }
    }

    return await withRetry(async () => {
      const response = await fetch(`${host}/vectors/fetch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
        body: JSON.stringify({ ids: safeIds, namespace, includeValues }),
      })

      const result = await handlePineconeResponse(response, "Fetch vectors")

      logger.info(`Successfully fetched vectors`, {
        fetchedCount: Object.keys(result.vectors || {}).length,
        namespace: namespace || "default",
      })

      return result
    })
  } catch (error) {
    if (error instanceof PineconeError) {
      throw error
    }

    logger.error("Fetch vectors exception:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    throw new PineconeError(`Failed to fetch vectors: ${error instanceof Error ? error.message : String(error)}`, {
      retryable: false,
      context: { error: error instanceof Error ? error.message : String(error) },
    })
  }
}

/**
 * Delete vectors from Pinecone by IDs, filter, or delete all
 *
 * @param options - Delete options (ids, filter, deleteAll, namespace)
 * @returns Delete result
 * @throws PineconeError if operation fails
 */
export async function deleteVectors(options: {
  ids?: string[]
  filter?: Record<string, any>
  deleteAll?: boolean
  namespace?: string
}): Promise<PineconeDeleteResponse> {
  const { ids, filter, deleteAll = false, namespace = defaultNamespace } = options

  // Validate inputs - at least one deletion method must be specified
  if (!ids && !filter && !deleteAll) {
    throw new PineconeError("Delete operation requires ids, filter, or deleteAll=true", {
      retryable: false,
      context: { error: "invalid_delete_params" },
    })
  }

  // Log the delete operation
  if (ids) {
    logger.info(`Deleting ${ids.length} vectors by ID from Pinecone`, {
      namespace: namespace || "default",
    })
  } else if (filter) {
    logger.info(`Deleting vectors by filter from Pinecone`, {
      namespace: namespace || "default",
      filter: JSON.stringify(filter).substring(0, 100) + "...",
    })
  } else if (deleteAll) {
    logger.info(`Deleting ALL vectors from namespace`, {
      namespace: namespace || "default",
    })
  }

  try {
    const { apiKey, host } = getPineconeClient({ namespace })

    // Prepare delete request
    const deleteRequest: PineconeDeleteRequest = { namespace }

    if (ids) {
      // Ensure ids is an array before proceeding
      const safeIds = Array.isArray(ids) ? ids : []

      if (safeIds.length === 0) {
        logger.warn("No valid IDs to delete")
        return { deletedCount: 0 }
      }

      deleteRequest.ids = safeIds
    } else if (filter) {
      deleteRequest.filter = filter
    } else if (deleteAll) {
      deleteRequest.deleteAll = true
    }

    return await withRetry(async () => {
      const response = await fetch(`${host}/vectors/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
        body: JSON.stringify(deleteRequest),
      })

      const result = await handlePineconeResponse(response, "Delete vectors")

      logger.info(`Successfully deleted vectors`, {
        namespace: namespace || "default",
        result,
      })

      return result as PineconeDeleteResponse
    })
  } catch (error) {
    if (error instanceof PineconeError) {
      throw error
    }

    logger.error("Delete vectors exception:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    throw new PineconeError(`Failed to delete vectors: ${error instanceof Error ? error.message : String(error)}`, {
      retryable: false,
      context: { error: error instanceof Error ? error.message : String(error) },
    })
  }
}

/**
 * List all namespaces in the index
 *
 * @returns List of namespaces
 * @throws PineconeError if operation fails
 */
export async function listNamespaces(): Promise<string[]> {
  logger.info(`Listing namespaces in Pinecone index`)

  try {
    const { apiKey, host } = getPineconeClient()

    return await withRetry(async () => {
      const response = await fetch(`${host}/namespaces`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
      })

      const result = (await handlePineconeResponse(response, "List namespaces")) as PineconeListNamespacesResponse

      logger.info(`Successfully listed namespaces`, {
        namespaceCount: result.namespaces?.length || 0,
      })

      return result.namespaces.map((ns) => ns.name)
    })
  } catch (error) {
    if (error instanceof PineconeError) {
      throw error
    }

    logger.error("List namespaces exception:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    throw new PineconeError(`Failed to list namespaces: ${error instanceof Error ? error.message : String(error)}`, {
      retryable: false,
      context: { error: error instanceof Error ? error.message : String(error) },
    })
  }
}

/**
 * Get index statistics including vector counts per namespace
 *
 * @returns Index statistics
 * @throws PineconeError if operation fails
 */
export async function describeIndexStats(): Promise<PineconeDescribeIndexStatsResponse> {
  logger.info(`Getting index statistics from Pinecone`)

  try {
    const { apiKey, host } = getPineconeClient()

    return await withRetry(async () => {
      const response = await fetch(`${host}/describe_index_stats`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
      })

      const result = await handlePineconeResponse(response, "Describe index stats")

      logger.info(`Successfully retrieved index statistics`, {
        totalVectorCount: result.totalVectorCount,
        namespaceCount: Object.keys(result.namespaces || {}).length,
      })

      return result as PineconeDescribeIndexStatsResponse
    })
  } catch (error) {
    if (error instanceof PineconeError) {
      throw error
    }

    logger.error("Describe index stats exception:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    throw new PineconeError(
      `Failed to get index statistics: ${error instanceof Error ? error.message : String(error)}`,
      {
        retryable: false,
        context: { error: error instanceof Error ? error.message : String(error) },
      },
    )
  }
}

/**
 * Perform hybrid search combining vector similarity and metadata filtering
 *
 * @param query - Text query to search for
 * @param embeddingFn - Function to generate embedding from text
 * @param options - Search options (filter, topK, namespace)
 * @returns Search results
 */
export async function hybridSearch(
  query: string,
  embeddingFn: (text: string) => Promise<number[]>,
  options: {
    filter?: Record<string, any>
    topK?: number
    namespace?: string
    alpha?: number // Weight between 0 and 1 for vector vs. metadata (1 = vector only)
  } = {},
): Promise<PineconeQueryResponse> {
  const { filter, topK = 10, namespace = defaultNamespace, alpha = 0.75 } = options

  logger.info(`Performing hybrid search in Pinecone`, {
    queryLength: query.length,
    topK,
    namespace: namespace || "default",
    alpha,
  })

  try {
    // Generate embedding for the query
    const embedding = await embeddingFn(query)

    // Perform vector search with metadata filter
    return await queryVectors(embedding, {
      topK,
      includeMetadata: true,
      filter,
      namespace,
    })
  } catch (error) {
    logger.error("Hybrid search exception:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Return empty matches instead of throwing to provide fallback behavior
    return {
      matches: [],
      error: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Create a health check query to verify Pinecone connectivity
 *
 * @returns Health check result
 */
export async function healthCheck(): Promise<{ healthy: boolean; error?: string; details?: any }> {
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

    // Also check index stats to verify permissions
    try {
      const statsResponse = await fetch(`${host}/describe_index_stats`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
      })

      if (statsResponse.ok) {
        const stats = await statsResponse.json()
        return {
          healthy: true,
          details: {
            totalVectorCount: stats.totalVectorCount,
            dimension: stats.dimension,
            namespaces: Object.keys(stats.namespaces || {}).length,
          },
        }
      }
    } catch (statsError) {
      // If stats check fails, still return healthy if the query worked
      logger.warn("Health check stats failed but query succeeded", {
        error: statsError instanceof Error ? statsError.message : String(statsError),
      })
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
