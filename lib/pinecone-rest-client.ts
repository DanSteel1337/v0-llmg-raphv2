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
 * Validates if a vector is valid for Pinecone (not all zeros)
 */
function isValidVector(vector: number[], vectorId: string): boolean {
  // Check if vector is all zeros
  if (vector.every((v) => v === 0)) {
    console.error("Rejecting all-zero vector", { vectorId })
    return false
  }

  // Check if vector has extremely low variance (near-zero vectors)
  const nonZeroValues = vector.filter((v) => v !== 0)
  if (nonZeroValues.length < vector.length * 0.01) {
    console.warn("Warning: Vector has very few non-zero values", {
      vectorId,
      totalDimensions: vector.length,
      nonZeroDimensions: nonZeroValues.length,
    })
    // Still allow it, but with a warning
  }

  return true
}

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(vectors: any[], namespace = "") {
  // Group vectors by document_id for better logging
  const documentGroups = new Map<string, number>()
  vectors.forEach((vector) => {
    if (vector.metadata?.document_id) {
      const docId = vector.metadata.document_id
      documentGroups.set(docId, (documentGroups.get(docId) || 0) + 1)
    }
  })

  const documentCounts = Array.from(documentGroups.entries())
    .map(([docId, count]) => `${docId}: ${count}`)
    .join(", ")

  console.log(`Upserting ${vectors.length} vectors to Pinecone`, {
    namespace: namespace || "default",
    documentCounts: documentCounts || "No document IDs found",
    vectorCount: vectors.length,
  })

  try {
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not defined")
    }

    if (!host) {
      throw new Error("PINECONE_HOST is not defined")
    }

    // Filter out invalid vectors
    const validVectors = vectors.filter((vector) => {
      if (!vector.values || !Array.isArray(vector.values)) {
        console.error("Rejecting vector with missing or invalid values array", {
          vectorId: vector.id,
          hasValues: !!vector.values,
          isArray: Array.isArray(vector.values || null),
          documentId: vector.metadata?.document_id || "unknown",
        })
        return false
      }

      try {
        // Validate vector dimension
        validateVectorDimension(vector.values)

        // Validate vector is not all zeros
        return isValidVector(vector.values, vector.id)
      } catch (error) {
        console.error("Rejecting invalid vector", {
          vectorId: vector.id,
          documentId: vector.metadata?.document_id || "unknown",
          error: error instanceof Error ? error.message : "Unknown error",
        })
        return false
      }
    })

    // Log if any vectors were filtered out
    if (validVectors.length < vectors.length) {
      console.warn(`Filtered out ${vectors.length - validVectors.length} invalid vectors`, {
        originalCount: vectors.length,
        validCount: validVectors.length,
        namespace: namespace || "default",
      })
    }

    // If no valid vectors remain, return early
    if (validVectors.length === 0) {
      console.warn("No valid vectors to upsert")
      return { upsertedCount: 0 }
    }

    const response = await fetch(`${host}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey,
      },
      body: JSON.stringify({ vectors: validVectors, namespace }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Pinecone upsert error: Status ${response.status}`, {
        statusText: response.statusText,
        error: errorText,
        host: host.split(".")[0], // Log only the first part of the host for security
        vectorCount: validVectors.length,
      })
      throw new Error(`Pinecone upsert failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()

    // Group successful vectors by document_id for better logging
    const successDocumentGroups = new Map<string, number>()
    validVectors.forEach((vector) => {
      if (vector.metadata?.document_id) {
        const docId = vector.metadata.document_id
        successDocumentGroups.set(docId, (successDocumentGroups.get(docId) || 0) + 1)
      }
    })

    const successDocumentCounts = Array.from(successDocumentGroups.entries())
      .map(([docId, count]) => `${docId}: ${count}`)
      .join(", ")

    console.log(`Successfully upserted vectors to Pinecone`, {
      upsertedCount: validVectors.length,
      namespace: namespace || "default",
      successDocumentCounts: successDocumentCounts || "No document IDs found",
      result,
    })

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
    namespace: namespace || "default",
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
      namespace: namespace || "default",
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
  console.log(`Deleting ${ids.length} vectors from Pinecone`, {
    namespace: namespace || "default",
  })

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
    console.log(`Successfully deleted vectors from Pinecone`, {
      deletedCount: ids.length,
      namespace: namespace || "default",
      result,
    })
    return result
  } catch (error) {
    console.error("Pinecone delete exception:", error)
    throw error
  }
}
