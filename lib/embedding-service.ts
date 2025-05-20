/**
 * Embedding Service
 *
 * Handles embedding generation using OpenAI's API.
 * This service is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/lib/embedding-config for model and dimension configuration
 * - @/lib/utils/logger for logging
 */

import { EMBEDDING_MODEL, validateVectorDimension } from "./embedding-config"
import { logger } from "@/lib/utils/logger"

// Cache for the OpenAI API key
let openaiApiKey: string | null = null

/**
 * Gets the OpenAI API key from environment variables
 */
function getOpenAIApiKey(): string {
  if (!openaiApiKey) {
    openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not defined")
    }
  }
  return openaiApiKey
}

/**
 * Generates an embedding for the given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim() === "") {
    throw new Error("Cannot generate embedding for empty text")
  }

  try {
    const apiKey = getOpenAIApiKey()

    logger.info("Generating embedding", {
      textLength: text.length,
      model: EMBEDDING_MODEL,
    })

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: EMBEDDING_MODEL,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: "Unknown error" } }))
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const embedding = data.data[0].embedding

    // Validate the embedding
    validateVectorDimension(embedding)

    logger.info("Successfully generated embedding", {
      dimensions: embedding.length,
      model: EMBEDDING_MODEL,
    })

    return embedding
  } catch (error) {
    logger.error("Error generating embedding:", error)
    throw error
  }
}
