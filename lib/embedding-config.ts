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
  // If we're on the client side, throw a clear error or return client-safe defaults
  if (isClient) {
    console.warn("[EmbeddingConfig] Attempted to access server-only configuration on the client side")
    return {
      model: "text-embedding-3-large",
      dimensions: 3072,
      indexName: "pinecone-index", // This is just a placeholder
      host: "https://api.example.com", // This is just a placeholder
      isClientSide: true,
    }
  }

  // Minimal, hardcoded server-only configuration for embedding model and Pinecone.
  return {
    model: "text-embedding-3-large",
    dimensions: 3072,
    indexName: process.env.PINECONE_INDEX_NAME!,
    host: process.env.PINECONE_HOST!,
    isClientSide: false,
  }
}

// Create a safe version of the config that won't throw on the client side
let config: ReturnType<typeof getEmbeddingConfig>
try {
  config = getEmbeddingConfig()
} catch (error) {
  if (isClient) {
    console.warn("[EmbeddingConfig] Using client-side fallback configuration")
    config = {
      model: "text-embedding-3-large",
      dimensions: 3072,
      indexName: "pinecone-index", // This is just a placeholder
      host: "https://api.example.com", // This is just a placeholder
      isClientSide: true,
    }
  } else {
    // Re-throw the error on the server side
    throw error
  }
}

// Export the configuration values
export const EMBEDDING_MODEL = "text-embedding-3-large"
export const VECTOR_DIMENSION = 3072
export const INDEX_NAME = config.indexName
export const PINECONE_HOST = config.host
export const IS_CLIENT_SIDE = config.isClientSide

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

  // Check if vector is all zeros or has very few non-zero values
  const nonZeroCount = vector.filter((v) => v !== 0).length
  if (nonZeroCount === 0) {
    throw new Error("[EmbeddingConfig] Invalid vector: contains only zeros")
  }

  if (nonZeroCount < vector.length * 0.01) {
    console.warn("[EmbeddingConfig] Warning: Vector has very few non-zero values", {
      totalDimensions: vector.length,
      nonZeroDimensions: nonZeroCount,
    })
  }
}

// Create a dummy vector with the correct dimensions for testing/querying
export function createDummyVector(): number[] {
  // Create a vector with small random values instead of all zeros
  // This helps avoid issues with zero vectors in some vector DBs
  return Array(VECTOR_DIMENSION)
    .fill(0)
    .map(() => Math.random() * 0.001)
}
