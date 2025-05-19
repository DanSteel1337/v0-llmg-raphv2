/**
 * Pinecone REST Client
 *
 * A lightweight client for interacting with Pinecone vector database via REST API.
 * This client is designed to work in serverless environments and edge functions.
 *
 * Dependencies:
 * - @/lib/embedding-config.ts for configuration
 */

import { getEmbeddingConfig } from "@/lib/embedding-config"

// Get configuration
const { indexName, host, dimensions } = getEmbeddingConfig()

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(vectors: any[]): Promise<any> {
  try {
    console.log(`Upserting ${vectors.length} vectors to Pinecone index: ${indexName}`)

    // Validate vectors
    for (const vector of vectors) {
      if (!vector.id) {
        throw new Error("Vector ID is required")
      }

      if (!vector.values || !Array.isArray(vector.values)) {
        throw new Error("Vector values must be an array")
      }

      if (vector.values.length !== dimensions) {
        throw new Error(`Vector dimension mismatch: expected ${dimensions}, got ${vector.values.length}`)
      }
    }

    const response = await fetch(`${host}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.PINECONE_API_KEY!,
      },
      body: JSON.stringify({
        vectors,
        namespace: "",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Pinecone upsert error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`Pinecone upsert failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error upserting vectors to Pinecone:", error)
    throw error
  }
}

/**
 * Query vectors from Pinecone
 */
export async function queryVectors(
  vector: number[],
  topK = 10,
  includeMetadata = true,
  filter: any = {},
): Promise<any> {
  try {
    console.log(`Querying Pinecone index: ${indexName} with topK=${topK}`)

    // Validate vector
    if (!vector || !Array.isArray(vector)) {
      throw new Error("Vector must be an array")
    }

    if (vector.length !== dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${dimensions}, got ${vector.length}`)
    }

    const response = await fetch(`${host}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.PINECONE_API_KEY!,
      },
      body: JSON.stringify({
        vector,
        topK,
        includeMetadata,
        filter,
        namespace: "",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Pinecone query error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`Pinecone query failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error querying vectors from Pinecone:", error)
    throw error
  }
}

/**
 * Delete vectors from Pinecone
 */
export async function deleteVectors(ids: string[]): Promise<any> {
  try {
    console.log(`Deleting ${ids.length} vectors from Pinecone index: ${indexName}`)

    const response = await fetch(`${host}/vectors/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.PINECONE_API_KEY!,
      },
      body: JSON.stringify({
        ids,
        namespace: "",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Pinecone delete error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`Pinecone delete failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error deleting vectors from Pinecone:", error)
    throw error
  }
}

/**
 * Health check for Pinecone
 */
export async function healthCheck(): Promise<boolean> {
  try {
    console.log(`Checking health of Pinecone index: ${indexName}`)

    const response = await fetch(`${host}/describe_index_stats`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.PINECONE_API_KEY!,
      },
    })

    if (!response.ok) {
      console.error(`Pinecone health check failed: ${response.status} ${response.statusText}`)
      return false
    }

    return true
  } catch (error) {
    console.error("Error checking Pinecone health:", error)
    return false
  }
}
