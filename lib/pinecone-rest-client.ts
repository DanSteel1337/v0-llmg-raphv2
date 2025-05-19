/**
 * Edge-compatible Pinecone REST client
 *
 * Provides direct REST API access to Pinecone without requiring the SDK.
 * This ensures full compatibility with Edge runtime.
 */

import { validateVectorDimension, VECTOR_DIMENSION } from "./embedding-config"

// Singleton instance
let apiKey: string | null = null
let indexName: string | null = null

/**
 * Gets the Pinecone client configuration
 */
export function getPineconeClient() {
  if (!apiKey) {
    apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not defined")
    }
  }

  if (!indexName) {
    indexName = process.env.PINECONE_INDEX_NAME
    if (!indexName) {
      throw new Error("PINECONE_INDEX_NAME is not defined")
    }
  }

  const host = `https://${indexName}.svc.${process.env.PINECONE_ENVIRONMENT || "gcp-starter"}.pinecone.io`

  return { apiKey, indexName, host }
}

/**
 * Implements exponential backoff retry logic
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

      console.log(`Rate limited (${response.status}). Retrying in ${waitTime}ms. Retries left: ${retries}`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))

      return fetchWithRetry(url, options, retries - 1, backoff * 2)
    }

    return response
  } catch (error) {
    if (retries === 0) throw error

    console.log(`Network error. Retrying in ${backoff}ms. Retries left: ${retries}`)
    await new Promise((resolve) => setTimeout(resolve, backoff))

    return fetchWithRetry(url, options, retries - 1, backoff * 2)
  }
}

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(vectors: any[], namespace = "") {
  console.log(`Upserting ${vectors.length} vectors to Pinecone`, {
    namespace: namespace || "default",
    vectorCount: vectors.length,
  })

  try {
    const { apiKey, host } = getPineconeClient()

    // Filter out invalid vectors
    const validVectors = vectors.filter((vector) => {
      if (!vector.values || !Array.isArray(vector.values)) {
        console.error("Rejecting vector with missing or invalid values array", {
          vectorId: vector.id,
        })
        return false
      }

      try {
        // Validate vector dimension
        validateVectorDimension(vector.values)

        // Validate vector is not all zeros
        return !vector.values.every((v) => v === 0)
      } catch (error) {
        console.error("Rejecting invalid vector", {
          vectorId: vector.id,
          error: error instanceof Error ? error.message : "Unknown error",
        })
        return false
      }
    })

    // If no valid vectors remain, return early
    if (validVectors.length === 0) {
      console.warn("No valid vectors to upsert")
      return { upsertedCount: 0 }
    }

    // Process in batches of 100
    const BATCH_SIZE = 100
    let totalUpserted = 0

    for (let i = 0; i < validVectors.length; i += BATCH_SIZE) {
      // Ensure validVectors is an array before slicing
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
        throw new Error(`Upsert failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      totalUpserted += batch.length

      console.log(`Successfully upserted batch of vectors`, {
        batchSize: batch.length,
        totalUpserted,
        namespace: namespace || "default",
      })
    }

    return { upsertedCount: totalUpserted }
  } catch (error) {
    console.error("Upsert exception:", error)
    throw error
  }
}

/**
 * Query vectors from Pinecone
 */
export async function queryVectors(
  vector: number[],
  topK = 5,
  includeMetadata = true,
  filter?: Record<string, any>,
  namespace = "",
) {
  console.log(`Querying Pinecone`, {
    topK,
    filter: filter ? JSON.stringify(filter).substring(0, 100) + "..." : "none",
    namespace: namespace || "default",
  })

  try {
    const { apiKey, host } = getPineconeClient()

    // Validate query vector dimension
    validateVectorDimension(vector)

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
      console.error(`Query error: Status ${response.status}`, {
        statusText: response.statusText,
        error: errorText,
      })

      // Return empty matches instead of throwing to provide fallback behavior
      return { matches: [], error: true, status: response.status }
    }

    const result = await response.json()
    console.log(`Query successful`, {
      matchCount: result.matches?.length || 0,
      namespace: namespace || "default",
    })
    return result
  } catch (error) {
    console.error("Query exception:", error)
    // Return empty matches instead of throwing to provide fallback behavior
    return { matches: [], error: true, errorMessage: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Delete vectors from Pinecone
 */
export async function deleteVectors(ids: string[], namespace = "") {
  console.log(`Deleting ${ids.length} vectors from Pinecone`, {
    namespace: namespace || "default",
  })

  try {
    const { apiKey, host } = getPineconeClient()

    // Ensure ids is an array before proceeding
    const safeIds = Array.isArray(ids) ? ids : []

    if (safeIds.length === 0) {
      console.warn("No valid IDs to delete")
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
      throw new Error(`Delete failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    console.log(`Successfully deleted vectors`, {
      deletedCount: safeIds.length,
      namespace: namespace || "default",
      result,
    })
    return result
  } catch (error) {
    console.error("Delete exception:", error)
    throw error
  }
}

/**
 * Create a health check query to verify Pinecone connectivity
 */
export async function healthCheck(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const { apiKey, host } = getPineconeClient()

    // Create a minimal vector for the health check
    const dummyVector = Array(VECTOR_DIMENSION)
      .fill(0)
      .map(() => Math.random() * 0.001)

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
      return {
        healthy: false,
        error: `Health check failed: ${response.status} ${response.statusText} - ${errorText}`,
      }
    }

    return { healthy: true }
  } catch (error) {
    return {
      healthy: false,
      error: `Health check exception: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
