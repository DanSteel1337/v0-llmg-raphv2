/**
 * Edge-compatible embedding service
 */

import { openai } from "@ai-sdk/openai"
import { embed } from "ai"

/**
 * Generate an embedding for the given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  })

  return embedding
}
