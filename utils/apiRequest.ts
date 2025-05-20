/**
 * API request handler utility
 * Provides consistent request handling for API routes
 */

import { NextResponse } from "next/server"
import { logger } from "@/lib/utils/logger"

/**
 * Handles API requests with consistent response formatting
 * @param handler - Async function that processes the request
 * @param req - The incoming request
 * @returns Formatted API response
 */
export const handleApiRequest = async (handler: () => Promise<any>, req: Request): Promise<Response> => {
  try {
    const method = req.method
    const url = new URL(req.url)

    logger.info(`API Request: ${method} ${url.pathname}`)

    const result = await handler()

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error("API request error:", {
      error: error instanceof Error ? error.message : String(error),
      path: new URL(req.url).pathname,
    })

    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
    const statusCode = error instanceof Error && "statusCode" in error ? (error as any).statusCode : 500

    return NextResponse.json({ success: false, error: errorMessage }, { status: statusCode })
  }
}
