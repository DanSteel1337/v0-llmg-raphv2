/**
 * Edge-compatible Pinecone REST client
 *
 * Provides direct REST API access to Pinecone without requiring the SDK.
 * This ensures full compatibility with Edge runtime.
 */

import { validateVectorDimension } from "./embedding-config"

// Environment variables with validation
const apiKey = process.env.PINECONE_API_KEY
if (!apiKey) {
  console.error("PINECONE_API_KEY is not defined")
}

// Use direct host URL instead of constructing it
const host = process.env.PINECONE_HOST
if (!host) {
  console.error("PINECONE_HOST is not defined")
}

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(vectors: any[], namespace = "") {
  console.log(`Upserting ${vectors.length} vectors to Pinecone`)

  try {
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not defined")
    }

    if (!host) {
      throw new Error("PINECONE_HOST is not defined")
    }

    // Validate all vector dimensions before sending to Pinecone
    for (const vector of vectors) {
      if (vector.values && Array.isArray(vector.values)) {
        validateVectorDimension(vector.values)
      }
    }

    const response = await fetch(`${host}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({ vectors, namespace }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Pinecone upsert error: Status ${response.status}`, {
        statusText: response.statusText,
        error: errorText,
        host: host.split(".")[0], // Log only the first part of the host for security
        vectorCount: vectors.length,
      })
      throw new Error(`Pinecone upsert failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    console.log(`Successfully upserted vectors to Pinecone`, { upsertedCount: vectors.length, result })
    return result
  } catch (error) {
    console.error("Pinecone upsert exception:", error)
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
  })

  try {
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not defined")
    }

    if (!host) {
      throw new Error("PINECONE_HOST is not defined")
    }

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
      console.error(`Pinecone query error: Status ${response.status}`, {
        statusText: response.statusText,
        error: errorText,
        host: host.split(".")[0], // Log only the first part of the host for security
        topK,
        filter: filter ? JSON.stringify(filter).substring(0, 100) + "..." : "none",
      })

      // Return empty matches instead of throwing to provide fallback behavior
      return { matches: [], error: true, status: response.status }
    }

    const result = await response.json()
    console.log(`Pinecone query successful`, {
      matchCount: result.matches?.length || 0,
      namespace,
    })
    return result
  } catch (error) {
    console.error("Pinecone query exception:", error)
    // Return empty matches instead of throwing to provide fallback behavior
    return { matches: [], error: true, errorMessage: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Delete vectors from Pinecone
 */
export async function deleteVectors(ids: string[], namespace = "") {
  console.log(`Deleting ${ids.length} vectors from Pinecone`)

  try {
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not defined")
    }

    if (!host) {
      throw new Error("PINECONE_HOST is not defined")
    }

    const response = await fetch(`${host}/vectors/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({ ids, namespace }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Pinecone delete error: Status ${response.status}`, {
        statusText: response.statusText,
        error: errorText,
        host: host.split(".")[0], // Log only the first part of the host for security
        idCount: ids.length,
      })
      throw new Error(`Pinecone delete failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    console.log(`Successfully deleted vectors from Pinecone`, { deletedCount: ids.length, result })
    return result
  } catch (error) {
    console.error("Pinecone delete exception:", error)
    throw error
  }
}
