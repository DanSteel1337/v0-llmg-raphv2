/**
 * Health Check API Route
 *
 * Provides health status for key services used by the application.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/utils/logger for logging
 * - @/lib/pinecone-rest-client for Pinecone health check
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { logger } from "@/lib/utils/logger"
import { healthCheck as pineconeHealthCheck } from "@/lib/pinecone-rest-client"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    logger.info("GET /api/health - Checking service health")

    // Check Pinecone health
    let pineconeHealthy = false
    let pineconeError = null
    try {
      const pineconeHealth = await pineconeHealthCheck()
      pineconeHealthy = pineconeHealth.healthy
      pineconeError = pineconeHealth.error

      logger.info("Pinecone health check result", {
        healthy: pineconeHealthy,
        error: pineconeError,
      })
    } catch (error) {
      pineconeError = error instanceof Error ? error.message : String(error)
      logger.error("Pinecone health check failed", {
        error: pineconeError,
      })
    }

    // Check OpenAI health - simple connectivity test
    let openaiHealthy = false
    let openaiError = null
    try {
      // Simple availability check using a minimal API call
      const openaiKey = process.env.OPENAI_API_KEY
      if (!openaiKey) {
        throw new Error("OPENAI_API_KEY is not defined")
      }

      const openaiResponse = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
      })

      openaiHealthy = openaiResponse.ok
      if (!openaiResponse.ok) {
        openaiError = `Status ${openaiResponse.status}: ${openaiResponse.statusText}`
      }

      logger.info("OpenAI health check result", {
        healthy: openaiHealthy,
        status: openaiResponse.status,
        error: openaiError,
      })
    } catch (error) {
      openaiError = error instanceof Error ? error.message : String(error)
      logger.error("OpenAI health check failed", {
        error: openaiError,
      })
    }

    // Return combined health status with detailed error information
    return {
      status: pineconeHealthy && openaiHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        pinecone: pineconeHealthy,
        openai: openaiHealthy,
      },
      errors: {
        pinecone: pineconeError,
        openai: openaiError,
      },
    }
  }, request)
})
