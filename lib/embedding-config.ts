/**
 * Embedding Configuration
 *
 * Centralizes embedding model selection and dimension validation.
 * This configuration is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - None
 */

// Configuration for the OpenAI embedding model
export const EMBEDDING_MODEL = "text-embedding-3-large"

// Dimension of vectors produced by the embedding model
export const VECTOR_DIMENSION = 3072

// Index name for Pinecone from environment variables
export const INDEX_NAME = process.env.PINECONE_INDEX_NAME || ""

// Pinecone host URL constructed from environment variables
export const PINECONE_HOST = `https://${INDEX_NAME}.svc.${process.env.PINECONE_ENVIRONMENT || "gcp-starter"}.pinecone.io`

/**
 * Validates vector dimensions against the expected dimension
 * Ensures vectors match the configured embedding model
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
