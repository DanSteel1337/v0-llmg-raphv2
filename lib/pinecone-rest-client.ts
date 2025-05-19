/**
 * Edge-compatible Pinecone REST client
 *
 * Provides direct REST API access to Pinecone without requiring the SDK.
 * This ensures full compatibility with Edge runtime.
 */

// Environment variables with validation
const apiKey = process.env.PINECONE_API_KEY
if (!apiKey) {
  console.error("PINECONE_API_KEY is not defined")
}

const indexName = process.env.PINECONE_INDEX_NAME
if (!indexName) {
  console.error("PINECONE_INDEX_NAME is not defined")
}

const environment = process.env.PINECONE_ENVIRONMENT
if (!environment) {
  console.error("PINECONE_ENVIRONMENT is not defined")
}

// Fixed URL construction for Pinecone serverless
const indexHost = `https://${indexName}.svc.${environment}.pinecone.io`

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(vectors: any[], namespace = "") {
  console.log(`Upserting ${vectors.length} vectors to Pinecone index: ${indexName}`)

  try {
    const response = await fetch(`${indexHost}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey || "",
      },
      body: JSON.stringify({ vectors, namespace }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Pinecone upsert error: Status ${response.status}`, {
        statusText: response.statusText,
        error: errorText,
        indexName,
        environment,
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
  console.log(`Querying Pinecone index: ${indexName}`, { topK, filter: JSON.stringify(filter).substring(0, 100) })

  try {
    const queryBody: any = {
      vector,
      topK,
      includeMetadata,
      namespace,
    }

    if (filter) {
      queryBody.filter = filter
    }

    const response = await fetch(`${indexHost}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey || "",
      },
      body: JSON.stringify(queryBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Pinecone query error: Status ${response.status}`, {
        statusText: response.statusText,
        error: errorText,
        indexName,
        environment,
        topK,
        filter: filter ? JSON.stringify(filter).substring(0, 100) : "none",
      })
      throw new Error(`Pinecone query failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    console.log(`Pinecone query successful`, {
      matchCount: result.matches?.length || 0,
      namespace,
    })
    return result
  } catch (error) {
    console.error("Pinecone query exception:", error)
    throw error
  }
}

/**
 * Delete vectors from Pinecone
 */
export async function deleteVectors(ids: string[], namespace = "") {
  console.log(`Deleting ${ids.length} vectors from Pinecone index: ${indexName}`)

  try {
    const response = await fetch(`${indexHost}/vectors/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": apiKey || "",
      },
      body: JSON.stringify({ ids, namespace }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Pinecone delete error: Status ${response.status}`, {
        statusText: response.statusText,
        error: errorText,
        indexName,
        environment,
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
