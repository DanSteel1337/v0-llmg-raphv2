/**
 * Edge-compatible embedding service
 */

import { openai } from "@ai-sdk/openai"
import { embed } from "ai"
import { EMBEDDING_MODEL, VECTOR_DIMENSION, validateVectorDimension } from "./embedding-config"

/**
 * Validates if text is suitable for embedding
 */
function validateInputText(text: string): void {
  if (!text || text.trim() === "") {
    throw new Error("Cannot generate embedding for empty or whitespace-only text")
  }

  if (text.length < 3) {
    throw new Error("Text is too short for meaningful embedding generation")
  }
}

/**
 * Validates if an embedding vector is valid (not all zeros)
 */
function validateEmbeddingVector(embedding: number[]): void {
  if (embedding.every((v) => v === 0)) {
    throw new Error("Invalid embedding generated: vector contains only zeros")
  }

  // Check if vector has extremely low variance (near-zero vectors)
  const nonZeroValues = embedding.filter((v) => v !== 0)
  if (nonZeroValues.length < embedding.length * 0.01) {
    console.warn("Warning: Embedding vector has very few non-zero values", {
      totalDimensions: embedding.length,
      nonZeroDimensions: nonZeroValues.length,
    })
  }
}

/**
 * Generate an embedding for the given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now()

  try {
    // Validate input text before calling the API
    validateInputText(text)

    console.log("Generating embedding for text", {
      textLength: text.length,
      model: EMBEDDING_MODEL,
      expectedDimension: VECTOR_DIMENSION,
      textSample: text.length > 100 ? `${text.substring(0, 100)}...` : text,
    })

    const { embedding } = await embed({
      model: openai.embedding(EMBEDDING_MODEL),
      value: text,
    })

    const duration = Date.now() - startTime

    // Validate the embedding dimension
    validateVectorDimension(embedding)

    // Validate the embedding is not all zeros
    validateEmbeddingVector(embedding)

    console.log("Successfully generated embedding", {
      dimensions: embedding.length,
      duration: `${duration}ms`,
      textLength: text.length,
      nonZeroValues: embedding.filter((v) => v !== 0).length,
    })

    return embedding
  } catch (error) {
    const duration = Date.now() - startTime

    console.error("Error generating embedding:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      textSample: text ? `${text.substring(0, 100)}...` : "undefined",
      textLength: text?.length,
      duration: `${duration}ms`,
      model: EMBEDDING_MODEL,
    })

    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
