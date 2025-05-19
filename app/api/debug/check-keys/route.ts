/**
 * API Key Check API Route
 *
 * API endpoint for checking the status of API keys.
 *
 * Dependencies:
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { createSuccessResponse, createErrorResponse } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"
import { EMBEDDING_MODEL } from "@/lib/embedding-config"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const service = searchParams.get("service")

  if (!service) {
    return createErrorResponse("Service parameter is required", 400)
  }

  try {
    if (service === "pinecone") {
      // Check Pinecone API key
      const apiKey = process.env.PINECONE_API_KEY
      const host = process.env.PINECONE_HOST

      if (!apiKey) {
        return createSuccessResponse({
          success: false,
          message: "Pinecone API key is not defined",
          status: "missing",
        })
      }

      if (!host) {
        return createSuccessResponse({
          success: false,
          message: "Pinecone host is not defined",
          status: "missing",
        })
      }

      // Make a simple request to Pinecone to check if the API key is valid
      try {
        const response = await fetch(`${host}/describe_index_stats`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": apiKey,
          },
        })

        if (response.ok) {
          const data = await response.json()
          return createSuccessResponse({
            success: true,
            message: "Pinecone API key is valid",
            status: "valid",
            indexStats: {
              namespaces: Object.keys(data.namespaces || {}),
              dimension: data.dimension,
              totalVectorCount: data.totalVectorCount,
            },
          })
        } else {
          return createSuccessResponse({
            success: false,
            message: `Pinecone API key is invalid: ${response.status} ${response.statusText}`,
            status: "invalid",
          })
        }
      } catch (error) {
        return createSuccessResponse({
          success: false,
          message: `Error checking Pinecone API key: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: "error",
        })
      }
    } else if (service === "openai") {
      // Check OpenAI API key
      const apiKey = process.env.OPENAI_API_KEY

      if (!apiKey) {
        return createSuccessResponse({
          success: false,
          message: "OpenAI API key is not defined",
          status: "missing",
        })
      }

      // Make a simple request to OpenAI to check if the API key is valid
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        })

        if (response.ok) {
          const data = await response.json()

          // Check if the embedding model is available
          const embeddingModelAvailable = data.data.some((model: any) => model.id === EMBEDDING_MODEL)

          return createSuccessResponse({
            success: true,
            message: "OpenAI API key is valid",
            status: "valid",
            embeddingModel: {
              name: EMBEDDING_MODEL,
              available: embeddingModelAvailable,
            },
            modelCount: data.data.length,
          })
        } else {
          return createSuccessResponse({
            success: false,
            message: `OpenAI API key is invalid: ${response.status} ${response.statusText}`,
            status: "invalid",
          })
        }
      } catch (error) {
        return createSuccessResponse({
          success: false,
          message: `Error checking OpenAI API key: ${error instanceof Error ? error.message : "Unknown error"}`,
          status: "error",
        })
      }
    } else {
      return createErrorResponse(`Unsupported service: ${service}`, 400)
    }
  } catch (error) {
    return createErrorResponse(
      `Error checking API key: ${error instanceof Error ? error.message : "Unknown error"}`,
      500,
    )
  }
})
