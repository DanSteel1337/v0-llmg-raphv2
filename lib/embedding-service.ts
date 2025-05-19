/**
 * Embedding Service
 *
 * Provides functions for generating embeddings using OpenAI.
 * Edge-compatible implementation that doesn't rely on Node.js modules.
 */

import { openai } from "@ai-sdk/openai"
import { embed } from "ai"

/**
 * Generates an embedding for the given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: text,
    })

    return embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw error
  }
}

/**
 * Generates embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const embeddings = await Promise.all(texts.map((text) => generateEmbedding(text)))

    return embeddings
  } catch (error) {
    console.error("Error generating embeddings:", error)
    throw error
  }
}
