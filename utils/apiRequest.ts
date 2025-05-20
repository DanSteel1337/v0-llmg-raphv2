/**
 * API Request Handler
 *
 * Provides standardized request handling for API routes.
 * This utility is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - next/server for NextResponse
 * - @/lib/utils/logger for logging
 */

import { NextResponse } from "next/server"
import { logger } from "@/lib/utils/logger"

/**
 * Handles API requests with consistent response formatting
 * @param handler - Async function that processes the request
 * @param req - The incoming request (optional)
 * @returns Formatted API response
 */
export const handleApiRequest = async (handler: () => Promise<any>, req?: Request): Promise<Response> => {
  try {
    const method = req?.method || "UNKNOWN"
    const url = req ? new URL(req.url) : { pathname: "UNKNOWN" }

    logger.info(`API Request: ${method} ${url.pathname}`)

    const result = await handler()

    // If result is already a Response, return it directly
    if (result instanceof Response) {
      return result
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error("API request error:", {
      error: error instanceof Error ? error.message : String(error),
      path: req ? new URL(req.url).pathname : "UNKNOWN",
    })

    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
    const statusCode = error instanceof Error && "statusCode" in error ? (error as any).statusCode : 500

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      {
        status: statusCode,
      },
    )
  }
}
