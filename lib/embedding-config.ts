/**
 * Embedding Configuration for Pinecone Serverless
 *
 * Provides consistent configuration for embeddings across the application.
 * Ensures vector dimensions match the chosen embedding model and Pinecone index configuration.
 * 
 * IMPORTANT SERVERLESS CONFIGURATION:
 * - text-embedding-3-large uses 3072 dimensions
 * - Pinecone index must be created with matching dimensions
 * - The host URL format for Serverless must be obtained from the Pinecone console
 *
 * @module lib/embedding-config
 */

// Configuration for the OpenAI embedding model
export const EMBEDDING_MODEL = "text-embedding-3-large"

// Dimension of vectors produced by the embedding model (3072 for text-embedding-3-large)
export const VECTOR_DIMENSION = 3072

// Index name from environment variables
export const INDEX_NAME = process.env.PINECONE_INDEX_NAME || ""

// Get Pinecone host from environment variables, with fallback options
export const PINECONE_HOST = process.env.PINECONE_HOST || process.env.PINECONE_ENVIRONMENT

/**
 * Validates vector dimensions against the expected dimension
 * Ensures vectors match the configured embedding model
 * 
 * @param vector - The vector array to validate
 * @throws Error if vector dimensions don't match or vector contains only zeros
 */
export function validateVectorDimension(vector: number[]): void {
  if (!vector || !Array.isArray(vector)) {
    throw new Error(`Invalid vector: expected array, got ${typeof vector}`)
  }

  if (vector.length !== VECTOR_DIMENSION) {
    throw new Error(
      `Vector dimension mismatch: Expected ${VECTOR_DIMENSION}, got ${vector.length}. ` +
        `Make sure you're using the correct embedding model (${EMBEDDING_MODEL}).`,
    )
  }

  // Check if vector is all zeros - Pinecone rejects these
  if (vector.every((v) => v === 0)) {
    throw new Error("Invalid vector: contains only zeros")
  }
}
