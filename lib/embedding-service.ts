/**
 * Edge-compatible embedding service
 */

import { openai } from "@ai-sdk/openai"
import { embed } from "ai"

/**
 * Generate an embedding for the given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.log("Generating embedding for text", { textLength: text.length })

    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: text,
    })

    console.log("Successfully generated embedding", { dimensions: embedding.length })
    return embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
