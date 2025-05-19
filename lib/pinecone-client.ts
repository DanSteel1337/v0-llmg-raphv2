/**
 * Pinecone Client
 *
 * Edge-compatible Pinecone client for vector operations.
 *
 * Dependencies:
 * - @pinecone-database/pinecone v0.5.2
 * - Environment variables: PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX_NAME
 */

import { PineconeClient } from "@pinecone-database/pinecone"

// Create a singleton client
const client = new PineconeClient()

/**
 * Get the Pinecone client singleton
 */
export async function getPineconeClient() {
  if (!client.apiKey) {
    await client.init({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT!,
    })
  }
  return client
}

/**
 * Get the Pinecone index singleton
 */
export async function getPineconeIndex() {
  const client = await getPineconeClient()
  const indexName = process.env.PINECONE_INDEX_NAME

  if (!indexName) {
    throw new Error("Missing required environment variable: PINECONE_INDEX_NAME")
  }

  return client.Index(indexName)
}
