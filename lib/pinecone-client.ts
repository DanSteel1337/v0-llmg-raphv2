/**
 * Pinecone Client
 *
 * Provides a singleton instance of the Pinecone client for vector operations.
 * This module ensures that only one connection to Pinecone is maintained
 * throughout the application lifecycle.
 *
 * IMPORTANT: This module should ONLY be imported in server-side code (API routes).
 * It uses Node.js specific modules that are not available in the browser.
 *
 * Dependencies:
 * - @pinecone-database/pinecone v0.5.2 for vector database operations
 * - Environment variables: PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX_NAME
 */

import { PineconeClient } from "@pinecone-database/pinecone"

// Prevent client-side usage
if (typeof window !== "undefined") {
  throw new Error(
    "Pinecone client cannot be used in browser environment. Import this module only in API routes or server components.",
  )
}

// Initialize the client
let pineconeClient: PineconeClient | null = null
let isInitialized = false

/**
 * Get the Pinecone client singleton
 */
export const getPineconeClient = async (): Promise<PineconeClient> => {
  if (!pineconeClient) {
    pineconeClient = new PineconeClient()
  }

  if (!isInitialized) {
    await pineconeClient.init({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT!,
    })
    isInitialized = true
  }

  return pineconeClient
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

/**
 * Reset the Pinecone client singleton
 * Useful for testing or when environment variables change
 */
export const resetPineconeClient = (): void => {
  pineconeClient = null
  isInitialized = false
}
