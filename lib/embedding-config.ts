/**
 * Embedding Configuration
 *
 * Centralizes embedding model selection and dimension validation.
 * This configuration is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - None
 */

export const EMBEDDING_MODEL = "text-embedding-3-large"
export const VECTOR_DIMENSION = 3072

// Add the missing exports that are referenced elsewhere in the codebase
export const INDEX_NAME = process.env.PINECONE_INDEX_NAME || ""
export const PINECONE_HOST = `https://${INDEX_NAME}.svc.${process.env.PINECONE_ENVIRONMENT || "gcp-starter"}.pinecone.io`

/**
 * Validates vector dimensions against the expected dimension
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

  // Check if vector is all zeros
  if (vector.every((v) => v === 0)) {
    throw new Error("Invalid vector: contains only zeros")
  }
}
