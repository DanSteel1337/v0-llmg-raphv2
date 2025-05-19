/**
 * Edge-compatible Pinecone client
 * Uses v3.0.1 of the Pinecone SDK
 */

import { PineconeClient } from "@pinecone-database/pinecone"

// Create a singleton client
const client = new PineconeClient()
let isInitialized = false

/**
 * Get the Pinecone client singleton
 */
export async function getPineconeClient() {
  if (!isInitialized) {
    await client.init({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT!,
    })
    isInitialized = true
  }
  return client
}

/**
 * Get the Pinecone index singleton
 */
export async function getPineconeIndex() {
  const client = await getPineconeClient()
  const indexName = process.env.PINECONE_INDEX_NAME!

  if (!indexName) {
    throw new Error("Missing required environment variable: PINECONE_INDEX_NAME")
  }

  return client.Index(indexName)
}
