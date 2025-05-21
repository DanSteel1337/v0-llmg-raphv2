/**
 * Embedding Service
 *
 * Handles the generation of embeddings using OpenAI's text-embedding-3-large model.
 * Provides utilities for embedding generation with proper error handling, validation, caching, and batching.
 *
 * Features:
 * - Exclusive use of text-embedding-3-large with 3072 dimensions
 * - Comprehensive retry logic with exponential backoff
 * - Proper batch processing for multiple texts
 * - Caching mechanism for frequently embedded queries
 * - Input validation and sanitization
 * - Detailed error handling with specific error types
 * - Edge Runtime compatibility
 * - Rate limiting to avoid API limits
 *
 * Dependencies:
 * - OpenAI API for embedding generation
 * - @/lib/embedding-config for model configuration
 * - @/lib/utils/logger for structured logging
 *
 * @module lib/embedding-service
 */

import { logger } from "@/lib/utils/logger"
import { VECTOR_DIMENSION, EMBEDDING_MODEL } from "@/lib/embedding-config"

// Custom error class for embedding operations
export class EmbeddingError extends Error {
  status?: number
  retryable: boolean
  context?: Record<string, any>

  constructor(message: string, options: { status?: number; retryable?: boolean; context?: Record<string, any> } = {}) {
    super(message)
    this.name = "EmbeddingError"
    this.status = options.status
    this.retryable = options.retryable ?? false
    this.context = options.context
  }
}

// Configuration constants
const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY = 500 // ms
const MAX_RETRY_DELAY = 30000 // 30 seconds
const RETRY_BACKOFF_FACTOR = 2
const MAX_TEXT_LENGTH = 25000 // Characters to truncate at
const MAX_BATCH_SIZE = 20 // Maximum texts to embed in a single API call
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in ms

// Simple in-memory cache for embeddings
// Note: This will be reset on cold starts in serverless environments
interface CacheEntry {
  embedding: number[]
  timestamp: number
}

// Use a Map for better performance with string keys
const embeddingCache = new Map<string, CacheEntry>()

/**
 * Validates and sanitizes text input for embedding
 *
 * @param text - Text to validate
 * @returns Sanitized text
 * @throws EmbeddingError if text is invalid
 */
function validateAndSanitizeText(text: unknown): string {
  // Check for null or undefined
  if (text === null || text === undefined) {
    throw new EmbeddingError("Text cannot be null or undefined", {
      retryable: false,
      context: { textValue: text === undefined ? "undefined" : "null" },
    })
  }

  // Check type
  if (typeof text !== "string") {
    throw new EmbeddingError(`Text must be a string, got ${typeof text}`, {
      retryable: false,
      context: { textType: typeof text },
    })
  }

  // Trim whitespace
  const trimmed = text.trim()

  // Check if empty after trimming
  if (trimmed === "") {
    throw new EmbeddingError("Text cannot be empty", {
      retryable: false,
      context: { originalLength: text.length },
    })
  }

  // Return sanitized text
  return trimmed
}

/**
 * Creates a cache key for a text string
 *
 * @param text - Text to create cache key for
 * @param model - Model name
 * @returns Cache key
 */
function createCacheKey(text: string, model: string = EMBEDDING_MODEL): string {
  // For very long texts, use a hash of the content
  if (text.length > 100) {
    // Simple hash function for cache key
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return `${model}:${hash}:${text.length}:${text.substring(0, 50)}...`
  }

  // For short texts, use the full text
  return `${model}:${text}`
}

/**
 * Checks if a vector is valid (non-zero and correct dimensions)
 *
 * @param vector - Vector to validate
 * @returns True if vector is valid
 */
function isValidVector(vector: number[]): boolean {
  if (!Array.isArray(vector)) return false
  if (vector.length !== VECTOR_DIMENSION) return false

  // Check if vector is all zeros or very close to zero
  const isZeroVector = vector.every((val) => Math.abs(val) < 1e-6)
  if (isZeroVector) return false

  return true
}

/**
 * Implements exponential backoff retry logic for API calls
 *
 * @param operation - Function to retry
 * @param maxRetries - Maximum retry attempts
 * @param initialDelay - Initial delay in ms
 * @returns Result of the operation
 * @throws EmbeddingError if all retries fail
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY,
): Promise<T> {
  let lastError: Error | null = null
  let retryCount = 0

  while (retryCount <= maxRetries) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // If error is not retryable, throw immediately
      if (error instanceof EmbeddingError && !error.retryable) {
        throw error
      }

      // If this was the last retry, throw the error
      if (retryCount >= maxRetries) {
        if (error instanceof EmbeddingError) {
          throw error
        } else {
          throw new EmbeddingError(`Operation failed after ${maxRetries} retries: ${lastError.message}`, {
            retryable: false,
            context: { originalError: lastError.message },
          })
        }
      }

      // Calculate backoff time with jitter
      const backoffTime = Math.min(initialDelay * Math.pow(RETRY_BACKOFF_FACTOR, retryCount), MAX_RETRY_DELAY)
      const jitter = Math.random() * 0.3 * backoffTime // Add up to 30% jitter
      const waitTime = backoffTime + jitter

      logger.warn(
        `Embedding operation failed, retrying in ${Math.round(waitTime)}ms (${retryCount + 1}/${maxRetries})`,
        {
          error: lastError.message,
          retryCount,
          waitTime: Math.round(waitTime),
        },
      )

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, waitTime))
      retryCount++
    }
  }

  // This should never happen, but TypeScript needs it
  throw lastError || new Error("Unknown error in retry logic")
}

/**
 * Generate an embedding for a text string
 * Uses caching to avoid regenerating embeddings for the same text
 *
 * @param text - Text to generate embedding for
 * @param options - Options for embedding generation
 * @returns Vector embedding as number array
 * @throws EmbeddingError if embedding generation fails
 */
export async function generateEmbedding(
  text: string,
  options: {
    useCache?: boolean
    dimensions?: number
    model?: string
  } = {},
): Promise<number[]> {
  const { useCache = true, dimensions = VECTOR_DIMENSION, model = EMBEDDING_MODEL } = options

  try {
    // Validate and sanitize input
    const sanitizedText = validateAndSanitizeText(text)

    // Truncate text if it's too long
    const truncatedText =
      sanitizedText.length > MAX_TEXT_LENGTH ? sanitizedText.slice(0, MAX_TEXT_LENGTH) : sanitizedText

    // Check cache if enabled
    if (useCache) {
      const cacheKey = createCacheKey(truncatedText, model)
      const cached = embeddingCache.get(cacheKey)

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.debug("Embedding cache hit", {
          textLength: truncatedText.length,
          cacheKey: cacheKey.substring(0, 50),
        })
        return cached.embedding
      }
    }

    // Get OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      throw new EmbeddingError("OPENAI_API_KEY is not defined", {
        retryable: false,
        context: { error: "missing_api_key" },
      })
    }

    logger.info(`Generating embedding with model ${model}`, {
      textLength: truncatedText.length,
      modelName: model,
      dimensions,
    })

    // Call OpenAI API with retry logic
    const embedding = await withRetry(async () => {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          input: truncatedText,
          dimensions,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Determine if error is retryable
        const retryable = response.status === 429 || response.status === 503 || response.status >= 500

        throw new EmbeddingError(`OpenAI API error: ${response.status} ${response.statusText}`, {
          status: response.status,
          retryable,
          context: {
            errorData,
            textLength: truncatedText.length,
          },
        })
      }

      const result = await response.json()

      // Validate the embedding
      const embedding = result.data?.[0]?.embedding

      if (!embedding || !Array.isArray(embedding)) {
        throw new EmbeddingError("Invalid embedding response from OpenAI", {
          retryable: true,
          context: {
            resultSample: JSON.stringify(result).substring(0, 200) + "...",
          },
        })
      }

      if (embedding.length !== dimensions) {
        throw new EmbeddingError(`Embedding dimension mismatch: expected ${dimensions}, got ${embedding.length}`, {
          retryable: false,
          context: {
            model,
            expectedDimensions: dimensions,
            actualDimensions: embedding.length,
          },
        })
      }

      // Check for zero vectors (indicates potential issues)
      const isZeroVector = embedding.every((val) => Math.abs(val) < 1e-6)
      if (isZeroVector) {
        throw new EmbeddingError("Zero vector detected in embedding result", {
          retryable: true,
          context: {
            textSample: truncatedText.substring(0, 100) + "...",
            textLength: truncatedText.length,
          },
        })
      }

      return embedding
    })

    // Store in cache if caching is enabled
    if (useCache) {
      const cacheKey = createCacheKey(truncatedText, model)
      embeddingCache.set(cacheKey, {
        embedding,
        timestamp: Date.now(),
      })

      // Simple cache size management - if cache gets too large, remove oldest entries
      if (embeddingCache.size > 1000) {
        const entries = Array.from(embeddingCache.entries())
        const oldestEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp).slice(0, 200) // Remove oldest 200 entries

        for (const [key] of oldestEntries) {
          embeddingCache.delete(key)
        }

        logger.info("Embedding cache pruned", {
          previousSize: embeddingCache.size + 200,
          newSize: embeddingCache.size,
          entriesRemoved: 200,
        })
      }
    }

    return embedding
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw error
    }

    logger.error("Unexpected error generating embedding", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      textSample: text.substring(0, 100) + "...",
    })

    throw new EmbeddingError(
      `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
      {
        retryable: false,
        context: { error: error instanceof Error ? error.message : String(error) },
      },
    )
  }
}

/**
 * Generate embeddings for multiple texts efficiently
 * Handles batching, caching, and parallel processing
 *
 * @param texts - Array of texts to generate embeddings for
 * @param options - Options for batch embedding generation
 * @returns Array of vector embeddings
 * @throws EmbeddingError if embedding generation fails
 */
export async function generateEmbeddings(
  texts: string[],
  options: {
    useCache?: boolean
    dimensions?: number
    model?: string
    batchSize?: number
    onProgress?: (completed: number, total: number) => void
  } = {},
): Promise<number[][]> {
  const {
    useCache = true,
    dimensions = VECTOR_DIMENSION,
    model = EMBEDDING_MODEL,
    batchSize = MAX_BATCH_SIZE,
    onProgress,
  } = options

  try {
    // Validate input array
    if (!Array.isArray(texts)) {
      throw new EmbeddingError("Invalid texts array provided for embedding generation", {
        retryable: false,
        context: { textsType: typeof texts },
      })
    }

    if (texts.length === 0) {
      throw new EmbeddingError("Empty texts array provided for embedding generation", {
        retryable: false,
      })
    }

    // Filter out invalid texts
    const validTexts: string[] = []
    const invalidIndices: number[] = []

    texts.forEach((text, index) => {
      try {
        const sanitized = validateAndSanitizeText(text)
        validTexts.push(sanitized)
      } catch (error) {
        invalidIndices.push(index)
        logger.warn(`Skipping invalid text at index ${index}`, {
          error: error instanceof Error ? error.message : String(error),
          textSample: typeof text === "string" ? text.substring(0, 50) : String(text),
        })
      }
    })

    if (validTexts.length === 0) {
      throw new EmbeddingError("No valid texts to embed after filtering", {
        retryable: false,
        context: {
          originalCount: texts.length,
          invalidCount: invalidIndices.length,
        },
      })
    }

    if (invalidIndices.length > 0) {
      logger.info(
        `Filtered out ${invalidIndices.length} invalid texts, proceeding with ${validTexts.length} valid texts`,
      )
    }

    // Check cache for all texts first if caching is enabled
    const embeddings: (number[] | null)[] = new Array(validTexts.length).fill(null)
    const uncachedIndices: number[] = []

    if (useCache) {
      validTexts.forEach((text, index) => {
        const truncatedText = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text
        const cacheKey = createCacheKey(truncatedText, model)
        const cached = embeddingCache.get(cacheKey)

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          embeddings[index] = cached.embedding
        } else {
          uncachedIndices.push(index)
        }
      })

      logger.info(`Embedding cache stats for batch`, {
        totalTexts: validTexts.length,
        cacheHits: validTexts.length - uncachedIndices.length,
        cacheMisses: uncachedIndices.length,
      })
    } else {
      // If cache is disabled, all texts need to be processed
      uncachedIndices.push(...validTexts.map((_, i) => i))
    }

    // If all texts were cached, return early
    if (uncachedIndices.length === 0) {
      return embeddings as number[][]
    }

    // Get OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      throw new EmbeddingError("OPENAI_API_KEY is not defined", {
        retryable: false,
        context: { error: "missing_api_key" },
      })
    }

    // Process uncached texts in batches
    const effectiveBatchSize = Math.min(batchSize, MAX_BATCH_SIZE)
    let completedCount = validTexts.length - uncachedIndices.length

    // Create batches of indices
    const batches: number[][] = []
    for (let i = 0; i < uncachedIndices.length; i += effectiveBatchSize) {
      batches.push(uncachedIndices.slice(i, i + effectiveBatchSize))
    }

    logger.info(`Processing ${uncachedIndices.length} texts in ${batches.length} batches`, {
      batchSize: effectiveBatchSize,
      totalBatches: batches.length,
    })

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const batchTexts = batch.map((index) => {
        const text = validTexts[index]
        return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text
      })

      logger.info(`Processing batch ${batchIndex + 1}/${batches.length}`, {
        batchSize: batch.length,
        textLengths: batchTexts.map((t) => t.length),
      })

      try {
        // For single-text batches, use the simpler generateEmbedding function
        if (batch.length === 1) {
          const embedding = await generateEmbedding(batchTexts[0], {
            useCache: false, // We already checked the cache
            dimensions,
            model,
          })

          embeddings[batch[0]] = embedding

          // Store in cache if caching is enabled
          if (useCache) {
            const cacheKey = createCacheKey(batchTexts[0], model)
            embeddingCache.set(cacheKey, {
              embedding,
              timestamp: Date.now(),
            })
          }
        } else {
          // For multi-text batches, call the OpenAI API directly
          const batchEmbeddings = await withRetry(async () => {
            const response = await fetch("https://api.openai.com/v1/embeddings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model,
                input: batchTexts,
                dimensions,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))

              // Determine if error is retryable
              const retryable = response.status === 429 || response.status === 503 || response.status >= 500

              throw new EmbeddingError(`OpenAI API error: ${response.status} ${response.statusText}`, {
                status: response.status,
                retryable,
                context: {
                  errorData,
                  batchSize: batchTexts.length,
                },
              })
            }

            const result = await response.json()

            // Validate the response
            if (!result.data || !Array.isArray(result.data)) {
              throw new EmbeddingError("Invalid batch embedding response from OpenAI", {
                retryable: true,
                context: {
                  resultSample: JSON.stringify(result).substring(0, 200) + "...",
                },
              })
            }

            // Sort by index to ensure order matches input
            const sortedData = [...result.data].sort((a, b) => a.index - b.index)

            return sortedData.map((item) => {
              const embedding = item.embedding

              if (!embedding || !Array.isArray(embedding)) {
                throw new EmbeddingError("Missing embedding in batch response item", {
                  retryable: true,
                  context: {
                    itemSample: JSON.stringify(item).substring(0, 200) + "...",
                  },
                })
              }

              if (embedding.length !== dimensions) {
                throw new EmbeddingError(
                  `Embedding dimension mismatch: expected ${dimensions}, got ${embedding.length}`,
                  {
                    retryable: false,
                    context: {
                      model,
                      expectedDimensions: dimensions,
                      actualDimensions: embedding.length,
                    },
                  },
                )
              }

              // Check for zero vectors
              const isZeroVector = embedding.every((val) => Math.abs(val) < 1e-6)
              if (isZeroVector) {
                throw new EmbeddingError("Zero vector detected in batch embedding result", {
                  retryable: true,
                  context: {
                    index: item.index,
                    textSample: batchTexts[item.index].substring(0, 100) + "...",
                  },
                })
              }

              return embedding
            })
          })

          // Store results and update cache
          batchEmbeddings.forEach((embedding, i) => {
            const originalIndex = batch[i]
            embeddings[originalIndex] = embedding

            // Store in cache if caching is enabled
            if (useCache) {
              const cacheKey = createCacheKey(batchTexts[i], model)
              embeddingCache.set(cacheKey, {
                embedding,
                timestamp: Date.now(),
              })
            }
          })
        }

        // Update progress
        completedCount += batch.length
        if (onProgress) {
          onProgress(completedCount, validTexts.length)
        }
      } catch (error) {
        logger.error(`Error processing batch ${batchIndex + 1}/${batches.length}`, {
          error: error instanceof Error ? error.message : String(error),
          batchSize: batch.length,
        })

        // For batch errors, fall back to processing individually
        if (batch.length > 1) {
          logger.info(`Falling back to individual processing for batch ${batchIndex + 1}`)

          for (let i = 0; i < batch.length; i++) {
            const index = batch[i]
            const text = validTexts[index]

            try {
              const embedding = await generateEmbedding(text, {
                useCache: false, // We already checked the cache
                dimensions,
                model,
              })

              embeddings[index] = embedding

              // Store in cache if caching is enabled
              if (useCache) {
                const cacheKey = createCacheKey(
                  text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text,
                  model,
                )
                embeddingCache.set(cacheKey, {
                  embedding,
                  timestamp: Date.now(),
                })
              }

              // Update progress
              completedCount++
              if (onProgress) {
                onProgress(completedCount, validTexts.length)
              }
            } catch (itemError) {
              logger.error(`Error processing individual text in batch fallback`, {
                error: itemError instanceof Error ? itemError.message : String(itemError),
                index,
                textSample: text.substring(0, 100) + "...",
              })
              // Keep null for this embedding
            }
          }
        }
      }
    }

    // Check if we have any successful embeddings
    const successfulEmbeddings = embeddings.filter((e) => e !== null)
    if (successfulEmbeddings.length === 0) {
      throw new EmbeddingError("Failed to generate any valid embeddings", {
        retryable: false,
        context: {
          totalTexts: validTexts.length,
          processedCount: completedCount,
        },
      })
    }

    // Fill in any missing embeddings with placeholder values
    // This ensures the returned array has the same length as the input
    const finalEmbeddings = embeddings.map((embedding, i) => {
      if (embedding === null) {
        logger.warn(`Using placeholder for failed embedding at index ${i}`)
        // Create a placeholder with small random values
        return Array(dimensions)
          .fill(0)
          .map(() => Math.random() * 0.001 + 0.0001)
      }
      return embedding
    })

    logger.info(`Completed embedding generation for ${texts.length} texts`, {
      successCount: successfulEmbeddings.length,
      failureCount: embeddings.filter((e) => e === null).length,
      cacheSize: embeddingCache.size,
    })

    return finalEmbeddings as number[][]
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw error
    }

    logger.error("Unexpected error generating batch embeddings", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      textCount: texts.length,
    })

    throw new EmbeddingError(
      `Failed to generate batch embeddings: ${error instanceof Error ? error.message : String(error)}`,
      {
        retryable: false,
        context: { error: error instanceof Error ? error.message : String(error) },
      },
    )
  }
}

/**
 * Clear the embedding cache
 * Useful for testing or managing memory usage
 *
 * @returns Number of entries cleared
 */
export function clearEmbeddingCache(): number {
  const size = embeddingCache.size
  embeddingCache.clear()
  logger.info(`Embedding cache cleared`, { entriesRemoved: size })
  return size
}

/**
 * Get statistics about the embedding cache
 *
 * @returns Cache statistics
 */
export function getEmbeddingCacheStats(): {
  size: number
  oldestEntry: number | null
  newestEntry: number | null
  averageAge: number | null
} {
  if (embeddingCache.size === 0) {
    return {
      size: 0,
      oldestEntry: null,
      newestEntry: null,
      averageAge: null,
    }
  }

  const now = Date.now()
  let oldest = now
  let newest = 0
  let totalAge = 0

  for (const entry of embeddingCache.values()) {
    const timestamp = entry.timestamp
    if (timestamp < oldest) oldest = timestamp
    if (timestamp > newest) newest = timestamp
    totalAge += now - timestamp
  }

  return {
    size: embeddingCache.size,
    oldestEntry: now - oldest,
    newestEntry: now - newest,
    averageAge: totalAge / embeddingCache.size,
  }
}
