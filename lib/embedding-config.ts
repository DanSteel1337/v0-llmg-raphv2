/**
 * Embedding Configuration for Pinecone Serverless
 *
 * IMPORTANT SERVERLESS CONFIGURATION NOTES:
 * -----------------------------------------
 * 1. Pinecone Serverless indexes have unique host URLs that cannot be constructed
 *    from just the index name and environment.
 *
 * 2. The host URL format for Serverless is:
 *    {index-name}-{unique-id}.svc.{project-id}.pinecone.io
 *    Example: unrealengine54-pkpzmzh.svc.aped-4627-b74a.pinecone.io
 *
 * 3. Always use the exact host URL from Pinecone console or API, never construct it.
 *
 * 4. Ensure vector dimensions match your Pinecone index dimensions:
 *    - text-embedding-3-small: 1536 dimensions
 *    - text-embedding-3-large: 3072 dimensions
 *
 * 5. VECTOR_DIMENSION must match the dimension specified when creating your index.
 */

// Configuration for the OpenAI embedding model
export const EMBEDDING_MODEL = "text-embedding-3-large"

// Dimension of vectors produced by the embedding model
// Must match the dimension of your Pinecone index (3072 for text-embedding-3-large)
export const VECTOR_DIMENSION = 3072

// Index name from environment variables
export const INDEX_NAME = process.env.PINECONE_INDEX_NAME || ""

// IMPORTANT: Never construct the host URL - use the environment variable
// Set this in your Vercel project settings as PINECONE_HOST with the exact host URL
// from the Pinecone console
export const PINECONE_HOST = process.env.PINECONE_HOST

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
