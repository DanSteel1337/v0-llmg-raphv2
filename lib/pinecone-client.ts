/**
 * Pinecone Client
 *
 * Provides a singleton instance of the Pinecone client for vector operations.
 * This module ensures that only one connection to Pinecone is maintained
 * throughout the application lifecycle.
 *
 * Dependencies:
 * - @pinecone-database/pinecone v0.5.2 for vector database operations
 * - Environment variables: PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX_NAME
 */

import { PineconeClient } from "@pinecone-database/pinecone"

const client = new PineconeClient()

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
export const getPineconeIndex = async () => {
  const client = await getPineconeClient()
  const indexName = process.env.PINECONE_INDEX_NAME

  if (!indexName) {
    console.error("Missing Pinecone index name")
    throw new Error("Missing required environment variable: PINECONE_INDEX_NAME")
  }

  return client.Index(indexName)
}
