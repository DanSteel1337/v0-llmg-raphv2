/**
 * Embedding Service
 *
 * Handles generation of embeddings for text using OpenAI's embedding models.
 * Provides utilities for embedding generation, validation, and error handling.
 */

import { logger } from "@/lib/utils/logger"

// Constants for embedding configuration
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-large"
const EMBEDDING_DIMENSIONS = 3072 // Dimensions for text-embedding-3-large

/**
 * Generate an embedding for a text string
 *
 * @param text Text to generate embedding for
 * @returns Vector embedding as number array
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid text provided for embedding generation")
  }

  try {
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY is not defined")
    }

    // Truncate text if it's too long (OpenAI has token limits)
    // text-embedding-3-large has an 8191 token limit
    const truncatedText = text.length > 25000 ? text.slice(0, 25000) : text

    logger.info(`Generating embedding with model ${EMBEDDING_MODEL}`)

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: truncatedText,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error(`OpenAI API error: ${response.status} ${response.statusText}`, { errorData })
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    // Validate the embedding
    const embedding = result.data?.[0]?.embedding

    if (!embedding || !Array.isArray(embedding)) {
      logger.error("Invalid embedding response from OpenAI", { result })
      throw new Error("Invalid embedding response from OpenAI")
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      logger.error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`, {
        model: EMBEDDING_MODEL,
      })
      throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`)
    }

    // Check for zero vectors (indicates potential issues)
    const isZeroVector = embedding.every((val) => Math.abs(val) < 1e-6)
    if (isZeroVector) {
      logger.error("Zero vector detected in embedding result", { text: text.slice(0, 100) })
      throw new Error("Zero vector detected in embedding result")
    }

    return embedding
  } catch (error) {
    logger.error("Error generating embedding", {
      error: error instanceof Error ? error.message : "Unknown error",
      textLength: text.length,
    })
    throw error
  }
}

/**
 * Generate embeddings for multiple texts
 *
 * @param texts Array of texts to generate embeddings for
 * @returns Array of vector embeddings
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("Invalid texts array provided for embedding generation")
  }

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 10
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    // Process each text in the batch
    const batchPromises = batch.map((text) => generateEmbedding(text))

    try {
      const batchEmbeddings = await Promise.all(batchPromises)
      embeddings.push(...batchEmbeddings)
    } catch (error) {
      logger.error(`Error generating embeddings for batch ${i / BATCH_SIZE + 1}`, {
        error: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }

  return embeddings
}
