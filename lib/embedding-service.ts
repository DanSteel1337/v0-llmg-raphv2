/**
 * Embedding Service
 *
 * Handles the generation of embeddings using OpenAI's text-embedding-3-large model.
 * Provides utilities for embedding generation with proper error handling and validation.
 * 
 * Features:
 * - Consistent vector dimensions (3072 for text-embedding-3-large)
 * - Error handling and retries for API calls
 * - Vector validation to ensure quality
 * - Support for batch processing
 * 
 * Dependencies:
 * - OpenAI API for embedding generation
 * - @/lib/utils/logger for structured logging
 * 
 * @module lib/embedding-service
 */

import { logger } from "@/lib/utils/logger"
import { VECTOR_DIMENSION, EMBEDDING_MODEL } from "@/lib/embedding-config"

// Maximum retries for API calls
const MAX_RETRIES = 3

// Maximum text length for embedding
const MAX_TEXT_LENGTH = 25000

/**
 * Generate an embedding for a text string
 *
 * @param text - Text to generate embedding for
 * @param retryCount - Current retry attempt (for internal use)
 * @returns Vector embedding as number array
 */
export async function generateEmbedding(text: string, retryCount = 0): Promise<number[]> {
  // Enhanced validation for text input
  if (text === undefined || text === null) {
    logger.error("Invalid text provided for embedding generation - null or undefined", {
      textValue: text === undefined ? "undefined" : "null",
    });
    throw new Error("Invalid text provided for embedding generation: text is null or undefined");
  }
  
  if (typeof text !== "string") {
    logger.error("Invalid text provided for embedding generation - not a string", {
      textType: typeof text,
      textValue: String(text).substring(0, 100)
    });
    throw new Error(`Invalid text provided for embedding generation: expected string, got ${typeof text}`);
  }
  
  if (text.trim() === "") {
    logger.error("Invalid text provided for embedding generation - empty string", {
      textLength: text.length,
      textValue: text
    });
    throw new Error("Invalid text provided for embedding generation: text is empty");
  }

  try {
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY is not defined")
    }

    // Truncate text if it's too long (OpenAI has token limits)
    // text-embedding-3-large has an 8191 token limit
    const truncatedText = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text

    logger.info(`Generating embedding with model ${EMBEDDING_MODEL}`, {
      textLength: truncatedText.length,
      modelName: EMBEDDING_MODEL
    })

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: truncatedText,
        dimensions: VECTOR_DIMENSION, // Explicitly specify dimensions
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // Handle rate limiting with retries
      if ((response.status === 429 || response.status === 503) && retryCount < MAX_RETRIES) {
        const retryAfter = response.headers.get('Retry-After') 
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retryCount) * 1000
        
        logger.warn(`OpenAI API rate limited. Retrying in ${delayMs}ms. Attempt ${retryCount + 1}/${MAX_RETRIES}`, {
          status: response.status,
          retryAfter
        })
        
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return generateEmbedding(text, retryCount + 1)
      }
      
      logger.error(`OpenAI API error: ${response.status} ${response.statusText}`, { 
        errorData,
        textLength: truncatedText.length
      })
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    // Validate the embedding
    const embedding = result.data?.[0]?.embedding

    if (!embedding || !Array.isArray(embedding)) {
      logger.error("Invalid embedding response from OpenAI", { 
        result: JSON.stringify(result).substring(0, 200) + "..." 
      })
      throw new Error("Invalid embedding response from OpenAI")
    }

    if (embedding.length !== VECTOR_DIMENSION) {
      logger.error(`Embedding dimension mismatch: expected ${VECTOR_DIMENSION}, got ${embedding.length}`, {
        model: EMBEDDING_MODEL,
      })
      throw new Error(`Embedding dimension mismatch: expected ${VECTOR_DIMENSION}, got ${embedding.length}`)
    }

    // Check for zero vectors (indicates potential issues)
    const isZeroVector = embedding.every((val) => Math.abs(val) < 1e-6)
    if (isZeroVector) {
      logger.error("Zero vector detected in embedding result", { 
        textSample: text.substring(0, 100) + "...",
        textLength: text.length 
      })
      throw new Error("Zero vector detected in embedding result")
    }

    return embedding
  } catch (error) {
    // If we've already retried MAX_RETRIES times, give up
    if (retryCount >= MAX_RETRIES) {
      logger.error("Error generating embedding after max retries", {
        error: error instanceof Error ? error.message : "Unknown error",
        textLength: text.length,
        textSample: text.substring(0, 100) + "...",
        retries: retryCount
      })
      throw error
    }
    
    // For unexpected errors, retry with exponential backoff
    if (!(error instanceof Error && error.message.includes("dimension mismatch"))) {
      const delayMs = Math.pow(2, retryCount) * 1000
      
      logger.warn(`Unexpected error in embedding generation. Retrying in ${delayMs}ms. Attempt ${retryCount + 1}/${MAX_RETRIES}`, {
        error: error instanceof Error ? error.message : "Unknown error"
      })
      
      await new Promise(resolve => setTimeout(resolve, delayMs))
      return generateEmbedding(text, retryCount + 1)
    }
    
    throw error
  }
}

/**
 * Generate embeddings for multiple texts
 *
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of vector embeddings
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts)) {
    logger.error("Invalid texts array provided for embedding generation", {
      textsType: typeof texts,
    });
    throw new Error("Invalid texts array provided for embedding generation: not an array");
  }
  
  if (texts.length === 0) {
    logger.error("Empty texts array provided for embedding generation");
    throw new Error("Invalid texts array provided for embedding generation: empty array");
  }
  
  // Validate all texts before processing
  const invalidTexts = texts.filter(text => 
    text === undefined || 
    text === null || 
    typeof text !== 'string' || 
    text.trim() === ''
  );
  
  if (invalidTexts.length > 0) {
    logger.error("Invalid texts in array for embedding generation", {
      invalidCount: invalidTexts.length,
      examples: invalidTexts.slice(0, 3).map(t => 
        t === undefined ? 'undefined' : 
        t === null ? 'null' : 
        typeof t !== 'string' ? typeof t : 
        'empty string'
      )
    });
    
    // Filter out invalid texts instead of failing
    texts = texts.filter(text => 
      text !== undefined && 
      text !== null && 
      typeof text === 'string' && 
      text.trim() !== ''
    );
    
    if (texts.length === 0) {
      throw new Error("All texts in the array are invalid for embedding generation");
    }
    
    logger.warn(`Filtered out ${invalidTexts.length} invalid texts, proceeding with ${texts.length} valid texts`);
  }

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 10
  const embeddings: number[][] = []
  let failures = 0

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    logger.info(`Processing embedding batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(texts.length/BATCH_SIZE)}`, {
      batchSize: batch.length
    })

    // Process each text in the batch
    const batchPromises = batch.map((text) => generateEmbedding(text).catch(error => {
      logger.error(`Error generating embedding for batch item`, {
        error: error instanceof Error ? error.message : "Unknown error",
        textSample: text.substring(0, 100) + "..."
      })
      failures++
      // Return null for failed embeddings
      return null
    }))

    try {
      const batchEmbeddings = await Promise.all(batchPromises)
      // Filter out null values (failed embeddings)
      embeddings.push(...batchEmbeddings.filter(embedding => embedding !== null))
    } catch (error) {
      logger.error(`Error generating embeddings for batch ${i / BATCH_SIZE + 1}`, {
        error: error instanceof Error ? error.message : "Unknown error",
      })
      // Continue with next batch even if this one failed
    }
  }

  if (embeddings.length === 0 && failures > 0) {
    throw new Error(`Failed to generate any valid embeddings. All ${failures} attempts failed.`)
  }

  logger.info(`Completed embedding generation for ${texts.length} texts`, {
    successCount: embeddings.length,
    failureCount: failures
  })

  return embeddings
}
