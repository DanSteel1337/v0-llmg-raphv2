/**
 * Embedding Configuration
 *
 * Centralizes embedding model selection and dimension validation
 * based on the configured Pinecone index.
 */

// Get embedding configuration based on environment variables with strict validation
export const getEmbeddingConfig = () => {
  const model = process.env.EMBEDDING_MODEL
  const indexName = process.env.PINECONE_INDEX_NAME
  const host = process.env.PINECONE_HOST

  // Validate required environment variables
  const missingVars = []
  if (!model) missingVars.push("EMBEDDING_MODEL")
  if (!indexName) missingVars.push("PINECONE_INDEX_NAME")
  if (!host) missingVars.push("PINECONE_HOST")

  if (missingVars.length > 0) {
    throw new Error(`[EmbeddingConfig] Missing required env vars: ${missingVars.join(", ")}`)
  }

  // Validate model
  if (model !== "text-embedding-3-large") {
    throw new Error(`[EmbeddingConfig] Unsupported model: ${model}. Only text-embedding-3-large is supported.`)
  }

  // Validate host format
  if (!host.startsWith("https://")) {
    throw new Error(`[EmbeddingConfig] Invalid PINECONE_HOST format: ${host}. Must start with https://`)
  }

  // Extract index slug from host and validate it matches indexName
  const hostParts = host.split(".")
  if (hostParts.length < 2) {
    throw new Error(`[EmbeddingConfig] Invalid PINECONE_HOST format: ${host}`)
  }

  const hostIndexSlug = hostParts[0].split("//")[1]
  if (!hostIndexSlug || !hostIndexSlug.includes(indexName.toLowerCase())) {
    console.warn(
      `[EmbeddingConfig] Warning: PINECONE_INDEX_NAME (${indexName}) may not match host index slug (${hostIndexSlug})`,
    )
  }

  // Fixed dimensions for text-embedding-3-large
  const dimensions = 3072

  // Log the configuration
  console.log("[EmbeddingConfig] Configuration initialized:", {
    model,
    indexName,
    host: host.split(".")[0], // Only log the first part for security
    dimensions,
  })

  return {
    model,
    indexName,
    host,
    dimensions,
  }
}

// Get the configuration (will throw if invalid)
const config = getEmbeddingConfig()

// Export the configuration values
export const EMBEDDING_MODEL = config.model
export const VECTOR_DIMENSION = config.dimensions
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
