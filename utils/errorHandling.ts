/**
 * Error handling utility for API routes
 * Wraps API handlers with consistent error handling
 */

import { NextResponse } from "next/server"
import { logger } from "@/lib/utils/logger"

export type ApiHandler = (req: Request) => Promise<Response>

/**
 * Higher-order function that wraps API handlers with consistent error handling
 * @param handler - The API handler function to wrap
 * @returns A wrapped handler with error handling
 */
export const withErrorHandling = (handler: ApiHandler) => {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (error) {
      logger.error("API error:", { error: error instanceof Error ? error.message : String(error) })

      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      const statusCode = error instanceof Error && "statusCode" in error ? (error as any).statusCode : 500

      return NextResponse.json({ success: false, error: errorMessage }, { status: statusCode })
    }
  }
}
