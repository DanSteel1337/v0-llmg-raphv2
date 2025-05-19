/**
 * Embedding Configuration
 *
 * Centralizes embedding model selection and dimension validation
 * based on the configured Pinecone index.
 */

// Check if we're running on the client side
const isClient = typeof window !== "undefined"

// Get embedding configuration based on environment variables
export const getEmbeddingConfig = () => {
  // If we're on the client side, return client-safe defaults
  if (isClient) {
    return {
      model: "text-embedding-3-large",
      dimensions: 3072,
      indexName: "client-side-placeholder",
      host: "client-side-placeholder",
    }
  }

  // Server-side: validate required environment variables
  const apiKey = process.env.PINECONE_API_KEY
  const indexName = process.env.PINECONE_INDEX_NAME
  const host = process.env.PINECONE_HOST

  if (!apiKey) {
    throw new Error("[EmbeddingConfig] Missing required environment variable: PINECONE_API_KEY")
  }

  if (!indexName) {
    throw new Error("[EmbeddingConfig] Missing required environment variable: PINECONE_INDEX_NAME")
  }

  if (!host) {
    throw new Error("[EmbeddingConfig] Missing required environment variable: PINECONE_HOST")
  }

  // Minimal, hardcoded server-only configuration for embedding model and Pinecone
  return {
    model: "text-embedding-3-large",
    dimensions: 3072,
    indexName,
    host,
  }
}

// Create a safe version of the config that won't throw on the client side
let config
try {
  config = getEmbeddingConfig()
} catch (error) {
  if (isClient) {
    // Client-side fallback
    config = {
      model: "text-embedding-3-large",
      dimensions: 3072,
      indexName: "client-side-placeholder",
      host: "client-side-placeholder",
    }
  } else {
    // Re-throw on server side
    throw error
  }
}

// Export the configuration values
export const EMBEDDING_MODEL = "text-embedding-3-large"
export const VECTOR_DIMENSION = 3072
export const INDEX_NAME = config.indexName
export const PINECONE_HOST = config.host

// Validate vector dimensions against the expected dimension
export function validateVectorDimension(vector: number[]): void {
  if (!vector || !Array.isArray(vector)) {
    throw new Error(`[EmbeddingConfig] Invalid vector: expected array, got ${typeof vector}`)
  }

  if (vector.length !== VECTOR_DIMENSION) {
    throw new Error(
      `[EmbeddingConfig] Vector dimension mismatch: Expected ${VECTOR_DIMENSION}, got ${vector.length}. ` +
        `Make sure you're using the correct embedding model (${EMBEDDING_MODEL}).`,
    )
  }
}

// Create a dummy vector with the correct dimensions for testing/querying
export function createDummyVector(): number[] {
  return Array(VECTOR_DIMENSION)
    .fill(0)
    .map(() => Math.random() * 0.001)
}
