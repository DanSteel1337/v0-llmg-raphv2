/**
 * Edge-compatible Pinecone REST client
 *
 * Provides direct REST API access to Pinecone without requiring the SDK.
 * This ensures full compatibility with Edge runtime.
 */

// Environment variables
const apiKey = process.env.PINECONE_API_KEY!
const indexName = process.env.PINECONE_INDEX_NAME!
const environment = process.env.PINECONE_ENVIRONMENT!
const indexHost = `https://${indexName}-${environment}.svc.${environment}.pinecone.io`

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(vectors: any[], namespace = "") {
  const response = await fetch(`${indexHost}/vectors/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({ vectors, namespace }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Pinecone upsert error: ${error}`)
  }

  return response.json()
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
      "Api-Key": apiKey,
    },
    body: JSON.stringify(queryBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Pinecone query error: ${error}`)
  }

  return response.json()
}

/**
 * Delete vectors from Pinecone
 */
export async function deleteVectors(ids: string[], namespace = "") {
  const response = await fetch(`${indexHost}/vectors/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({ ids, namespace }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Pinecone delete error: ${error}`)
  }

  return response.json()
}
