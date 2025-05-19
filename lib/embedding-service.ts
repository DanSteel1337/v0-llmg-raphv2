/**
 * Edge-compatible embedding service
 */

import { openai } from "@ai-sdk/openai"
import { embed } from "ai"
import { EMBEDDING_MODEL, VECTOR_DIMENSION, validateVectorDimension } from "./embedding-config"

/**
 * Generate an embedding for the given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.log("Generating embedding for text", {
      textLength: text.length,
      model: EMBEDDING_MODEL,
      expectedDimension: VECTOR_DIMENSION,
    })

    const { embedding } = await embed({
      model: openai.embedding(EMBEDDING_MODEL),
      value: text,
    })

    // Validate the embedding dimension
    validateVectorDimension(embedding)

    console.log("Successfully generated embedding", { dimensions: embedding.length })
    return embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
