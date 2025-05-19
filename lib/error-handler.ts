/**
 * Error Handler
 *
 * Provides error handling utilities for API routes.
 *
 * Dependencies:
 * - next/server for NextResponse
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

type ApiHandler = (req: NextRequest, context: any) => Promise<NextResponse>

/**
 * Wraps an API handler with standardized error handling
 */
export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context: any) => {
    try {
      return await handler(req, context)
    } catch (error) {
      console.error("API Error:", error)

      const message = error instanceof Error ? error.message : "An unexpected error occurred"
      const status = error instanceof Error && "status" in error ? (error as any).status : 500

      return NextResponse.json({ error: message }, { status })
    }
  }
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(message: string, status = 500, details?: unknown): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...(details && { details }),
    },
    { status },
  )
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status },
  )
}
