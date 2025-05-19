/**
 * Embedding Configuration
 *
 * Centralizes embedding model selection and dimension validation
 * based on the configured Pinecone index.
 */

// Extract index name from PINECONE_HOST to determine dimensions
const PINECONE_HOST = process.env.PINECONE_HOST || ""
const indexName = PINECONE_HOST.split(".")[0].toLowerCase()

// Determine if this index uses the large model dimensions
// This is a simple check - in a production system, you might want to
// query the Pinecone index description API to get the actual dimensions
const isLargeDimension =
  indexName.includes("unrealengine") ||
  indexName.includes("large") ||
  process.env.EMBEDDING_MODEL === "text-embedding-3-large"

// Set the embedding model and dimensions based on the index
export const EMBEDDING_MODEL = isLargeDimension ? "text-embedding-3-large" : "text-embedding-3-small"
export const VECTOR_DIMENSION = isLargeDimension ? 3072 : 1536

// Validate vector dimensions against the expected dimension
export function validateVectorDimension(vector: number[]): void {
  if (vector.length !== VECTOR_DIMENSION) {
    throw new Error(
      `Vector dimension mismatch: Expected ${VECTOR_DIMENSION}, got ${vector.length}. ` +
        `Make sure you're using the correct embedding model (${EMBEDDING_MODEL}) ` +
        `for your Pinecone index (${indexName}).`,
    )
  }
}

// Log the configuration on startup
console.log(`Embedding configuration initialized:`, {
  indexName,
  model: EMBEDDING_MODEL,
  dimensions: VECTOR_DIMENSION,
})
