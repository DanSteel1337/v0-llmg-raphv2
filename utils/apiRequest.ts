/**
 * API Request Utilities
 *
 * Provides consistent request handling for API routes.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { logger } from "@/lib/utils/logger"

/**
 * Handle API request with consistent response format
 */
export async function handleApiRequest<T>(handler: () => Promise<T>, request?: NextRequest): Promise<NextResponse> {
  try {
    const result = await handler()

    // Log successful request if request object is provided
    if (request) {
      logger.info(`API request successful`, {
        path: request.nextUrl.pathname,
        method: request.method,
      })
    }

    // IMPROVED: Ensure we always return a valid JSON object with success flag
    if (result === undefined || result === null) {
      return NextResponse.json({ success: true })
    }

    // IMPROVED: Ensure the response always has a success property if not already present
    if (typeof result === 'object' && result !== null && !('success' in result)) {
      const responseWithSuccess = { 
        ...result, 
        success: true 
      }
      return NextResponse.json(responseWithSuccess)
    }

    return NextResponse.json(result)
  } catch (error) {
    // Log error if request object is provided
    if (request) {
      logger.error(`API request failed`, {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    )
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(body: any, fields: string[], context = "Request"): void {
  const missingFields = fields.filter((field) => !body[field])
  if (missingFields.length > 0) {
    throw new Error(`${context}: Missing required fields: ${missingFields.join(", ")}`)
  }
}
