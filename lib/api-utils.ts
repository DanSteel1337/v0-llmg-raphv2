/**
 * API Utilities
 *
 * This file is maintained for backward compatibility.
 * For new code, please use the utilities in @/utils/apiRequest.ts and @/utils/errorHandling.ts
 *
 * Dependencies:
 * - next/server for NextResponse
 * - @/lib/utils/logger for logging
 */

import { NextResponse } from "next/server"
import { logger } from "@/lib/utils/logger"

/**
 * Handle API request with consistent response format
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

/**
 * Validate required fields in request body
 * @param body - Request body to validate
 * @param fields - Array of required field names
 * @param context - Context for error message (default: "Request")
 * @throws Error if any required fields are missing
 */
export const validateRequiredFields = (body: any, fields: string[], context = "Request"): void => {
  const missingFields = fields.filter((field) => !body[field])
  if (missingFields.length > 0) {
    throw new Error(`${context}: Missing required fields: ${missingFields.join(", ")}`)
  }
}

/**
 * Create a standardized API error response
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 * @returns Formatted error response
 */
export const createErrorResponse = (message: string, status = 400): Response => {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    },
  )
}
