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
    throw new Error("[EmbeddingService] Cannot generate embedding for empty or whitespace-only text")
  }

  if (text.length < 3) {
    throw new Error("[EmbeddingService] Text is too short for meaningful embedding generation")
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

    console.log("[EmbeddingService] Generating embedding for text", {
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

    console.log("[EmbeddingService] Successfully generated embedding", {
      dimensions: embedding.length,
      duration: `${duration}ms`,
      textLength: text.length,
      nonZeroValues: embedding.filter((v) => v !== 0).length,
    })

    return embedding
  } catch (error) {
    const duration = Date.now() - startTime

    console.error("[EmbeddingService] Error generating embedding:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      textSample: text ? `${text.substring(0, 100)}...` : "undefined",
      textLength: text?.length,
      duration: `${duration}ms`,
      model: EMBEDDING_MODEL,
    })

    throw new Error(
      `[EmbeddingService] Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(
  texts: string[],
  documentId?: string,
  userId?: string,
): Promise<Array<{ text: string; embedding: number[] }>> {
  if (!texts.length) {
    console.warn("[EmbeddingService] No texts provided for embedding generation")
    return []
  }

  console.log(`[EmbeddingService] Generating embeddings for ${texts.length} texts`, {
    documentId,
    userId,
    model: EMBEDDING_MODEL,
    expectedDimension: VECTOR_DIMENSION,
  })

  const startTime = Date.now()
  const results: Array<{ text: string; embedding: number[] }> = []

  // Process in batches of 20 to avoid rate limits
  const batchSize = 20
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const batchStartTime = Date.now()

    try {
      console.log(
        `[EmbeddingService] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`,
        {
          batchSize: batch.length,
          documentId,
        },
      )

      // Filter out empty texts
      const validBatch = batch.filter((text) => text && text.trim() !== "")

      if (validBatch.length === 0) {
        console.warn("[EmbeddingService] Skipping batch with only empty texts")
        continue
      }

      // Generate embeddings for the batch
      const { embeddings } = await embed({
        model: openai.embedding(EMBEDDING_MODEL),
        values: validBatch,
      })

      // Validate and add results
      for (let j = 0; j < validBatch.length; j++) {
        try {
          validateVectorDimension(embeddings[j])
          results.push({
            text: validBatch[j],
            embedding: embeddings[j],
          })
        } catch (error) {
          console.error(`[EmbeddingService] Error validating embedding for text at index ${i + j}:`, {
            error: error instanceof Error ? error.message : "Unknown error",
            textSample: validBatch[j].substring(0, 100) + "...",
            dimensions: embeddings[j]?.length,
            expectedDimensions: VECTOR_DIMENSION,
          })
          // Skip this embedding
        }
      }

      const batchDuration = Date.now() - batchStartTime
      console.log(`[EmbeddingService] Batch processed in ${batchDuration}ms`, {
        batchSize: batch.length,
        validTexts: validBatch.length,
        embeddingsGenerated: embeddings.length,
      })
    } catch (error) {
      console.error(`[EmbeddingService] Error generating embeddings for batch starting at index ${i}:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        batchSize: batch.length,
        documentId,
      })
      // Continue with next batch
    }

    // Add a small delay between batches to avoid rate limits
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  const duration = Date.now() - startTime
  console.log(`[EmbeddingService] Generated ${results.length}/${texts.length} embeddings in ${duration}ms`, {
    documentId,
    model: EMBEDDING_MODEL,
    dimensions: VECTOR_DIMENSION,
  })

  return results
}
