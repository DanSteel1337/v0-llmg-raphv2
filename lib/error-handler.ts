/**
 * Error Handler
 *
 * Provides error handling utilities for API routes.
 */

import { type NextRequest, NextResponse } from "next/server"

type ApiHandler = (req: NextRequest) => Promise<NextResponse>

/**
 * Higher-order function to wrap API handlers with error handling
 */
export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest) => {
    try {
      return await handler(req)
    } catch (error) {
      console.error("API error caught by withErrorHandling:", error)

      // Ensure we return a proper error response
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
    }
  }
}
