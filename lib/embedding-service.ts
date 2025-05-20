/**
 * Embedding Service
 *
 * Provides functions for generating embeddings using OpenAI's text-embedding-3-large model.
 *
 * IMPORTANT NOTES:
 * ----------------
 * 1. Always use text-embedding-3-large for this project (3072 dimensions)
 * 2. Ensure OPENAI_API_KEY is set in your environment variables
 * 3. This service is designed to be used in Edge runtime
 *
 * Dependencies:
 * - @/lib/embedding-config for model configuration
 * - @/lib/utils/logger for logging
 */

import { EMBEDDING_MODEL, VECTOR_DIMENSION } from "@/lib/embedding-config"
import { logger } from "@/lib/utils/logger"

/**
 * Generates an embedding for the given text using OpenAI's API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim() === "") {
    throw new Error("Cannot generate embedding for empty text")
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not defined")
    }

    logger.info("Generating embedding", {
      model: EMBEDDING_MODEL,
      textLength: text.length,
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
      const errorData = await response.json().catch(() => ({}))
      logger.error("OpenAI API error", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      })
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const embedding = result.data[0].embedding

    // Validate embedding dimensions
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid embedding response from OpenAI API")
    }

    if (embedding.length !== VECTOR_DIMENSION) {
      logger.error("Embedding dimension mismatch", {
        expected: VECTOR_DIMENSION,
        actual: embedding.length,
        model: EMBEDDING_MODEL,
      })
      throw new Error(
        `Embedding dimension mismatch: Expected ${VECTOR_DIMENSION}, got ${embedding.length}. ` +
          `Make sure you're using the correct embedding model (${EMBEDDING_MODEL}).`,
      )
    }

    logger.info("Successfully generated embedding", {
      dimensions: embedding.length,
      model: EMBEDDING_MODEL,
    })

    return embedding
  } catch (error) {
    logger.error("Error generating embedding", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

/**
 * Generates embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return []
  }

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 20
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    // Process batch in parallel
    const batchPromises = batch.map((text) => generateEmbedding(text))
    const batchResults = await Promise.all(batchPromises)

    results.push(...batchResults)
  }

  return results
}
