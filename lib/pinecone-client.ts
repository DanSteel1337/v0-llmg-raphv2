// Info: This file implements the Singleton pattern for Pinecone client to prevent multiple instances
import { Pinecone } from "@pinecone-database/pinecone"
import type { Index } from "@pinecone-database/pinecone"

// Singleton instances - declared outside of functions to ensure they're truly singletons
let pineconeClient: Pinecone | null = null
let pineconeIndex: Index | null = null

// Create a Pinecone client
const createPineconeClient = (): Pinecone => {
  const apiKey = process.env.PINECONE_API_KEY

  if (!apiKey) {
    console.error("Missing Pinecone API key")
    throw new Error("Missing required environment variable: PINECONE_API_KEY")
  }

  return new Pinecone({ apiKey })
}

// Get the Pinecone client (singleton)
export const getPineconeClient = (): Pinecone => {
  if (!pineconeClient) {
    try {
      pineconeClient = createPineconeClient()
    } catch (error) {
      console.error("Error creating Pinecone client:", error)
      throw error
    }
  }
  return pineconeClient
}

// Get the Pinecone index (singleton)
export const getPineconeIndex = (): Index => {
  if (!pineconeIndex) {
    try {
      const client = getPineconeClient()
      const indexName = process.env.PINECONE_INDEX_NAME

      if (!indexName) {
        console.error("Missing Pinecone index name")
        throw new Error("Missing required environment variable: PINECONE_INDEX_NAME")
      }

      pineconeIndex = client.index(indexName)
    } catch (error) {
      console.error("Error getting Pinecone index:", error)
      throw error
    }
  }
  return pineconeIndex
}

// Reset clients (useful for testing)
export const resetPineconeClient = (): void => {
  pineconeClient = null
  pineconeIndex = null
}
