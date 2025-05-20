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
 * Uses caching for efficiency
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
 * Generates an embedding for the given text using OpenAI's API
 * Validates the embedding before returning
 * 
 * @param text The text to generate an embedding for
 * @returns Array of floating point values representing the embedding
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
      // Try to extract error details from the response
      let errorMessage = "Unknown OpenAI API error";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || `Status ${response.status}: ${response.statusText}`;
      } catch (parseError) {
        errorMessage = `Status ${response.status}: ${response.statusText}`;
      }
      
      logger.error("OpenAI API error:", {
        status: response.status,
        statusText: response.statusText,
        errorMessage
      });
      
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json()
    const embedding = data.data[0].embedding

    // Validate the embedding has the correct dimensions and is not all zeros
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
