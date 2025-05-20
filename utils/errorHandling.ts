/**
 * Error Handling Utilities
 *
 * Provides consistent error handling for API routes.
 * Implements standardized error handling, logging, and response formatting
 * for Edge API routes.
 * 
 * Features:
 * - Custom error classes for different error types
 * - Higher-order function for wrapping API handlers
 * - Consistent error response format
 * - Detailed error logging
 * 
 * @module utils/errorHandling
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { logger } from "@/lib/utils/logger"

/**
 * ValidationError class for handling validation errors
 */
export class ValidationError extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
    this.statusCode = 400
  }
}

/**
 * NotFoundError class for handling not found errors
 */
export class NotFoundError extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
    this.statusCode = 404
  }
}

/**
 * AuthorizationError class for handling authorization errors
 */
export class AuthorizationError extends Error {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.name = "AuthorizationError"
    this.statusCode = 403
  }
}

/**
 * RateLimitError class for handling rate limit errors
 */
export class RateLimitError extends Error {
  statusCode: number
  retryAfter?: number

  constructor(message: string, retryAfter?: number) {
    super(message)
    this.name = "RateLimitError"
    this.statusCode = 429
    this.retryAfter = retryAfter
  }
}

/**
 * Wrap an API handler with standardized error handling
 * 
 * @param handler - API route handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling(handler: (request: NextRequest, context?: any) => Promise<NextResponse>) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context)
    } catch (error) {
      // Log the error with request details for debugging
      logger.error("API error:", {
        path: request.nextUrl.pathname,
        method: request.method,
        query: request.nextUrl.search,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : "Unknown",
      })

      // Extract status code and prepare headers
      let statusCode = 500
      const headers: Record<string, string> = {}
      
      if (error instanceof ValidationError) {
        statusCode = error.statusCode
      } else if (error instanceof NotFoundError) {
        statusCode = error.statusCode
      } else if (error instanceof AuthorizationError) {
        statusCode = error.statusCode
      } else if (error instanceof RateLimitError) {
        statusCode = error.statusCode
        if (error.retryAfter) {
          headers["Retry-After"] = String(error.retryAfter)
        }
      } else if (error instanceof Error && 'statusCode' in error) {
        statusCode = (error as any).statusCode
      }

      // Prepare error message
      const errorMessage = error instanceof Error ? error.message : "Internal server error"

      // Return standardized error response
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          type: error instanceof Error ? error.name : "UnknownError" 
        },
        { 
          status: statusCode,
          headers
        }
      )
    }
  }
}

/**
 * Create a standardized error response
 * 
 * @param message - Error message
 * @param status - HTTP status code
 * @returns Error response
 */
export function createErrorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    }
  )
}
