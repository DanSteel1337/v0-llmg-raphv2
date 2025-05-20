/**
 * Error Handling Utilities
 *
 * Provides consistent error handling for API routes.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { logger } from "@/lib/utils/logger"

/**
 * ValidationError class for handling validation errors
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

/**
 * Wrap an API handler with standardized error handling
 */
export function withErrorHandling(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(request)
    } catch (error) {
      logger.error("API error:", {
        path: request.nextUrl.pathname,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })

      // Handle validation errors with 400 status
      if (error instanceof ValidationError) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 })
      }

      // Handle other errors with 500 status
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      )
    }
  }
}
