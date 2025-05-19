/**
 * Error Handler
 *
 * Provides consistent error handling for API routes
 */

import { NextResponse } from "next/server"

type ApiHandler = (req: Request) => Promise<NextResponse>

/**
 * Higher-order function that wraps an API handler with error handling
 */
export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (error) {
      console.error("API Error:", error)

      // Determine if this is an OpenAI API error
      const isOpenAIError =
        error.message && (error.message.includes("OpenAI") || error.message.includes("prompt and messages"))

      // Provide more detailed error for OpenAI issues
      const errorMessage = isOpenAIError
        ? `OpenAI API Error: ${error.message}. Please check your request format and API key.`
        : error.message || "An unknown error occurred"

      return NextResponse.json(
        {
          error: errorMessage,
          timestamp: new Date().toISOString(),
          path: req.url,
        },
        { status: 500 },
      )
    }
  }
}
