/**
 * API Utilities
 *
 * Common utilities for API routes.
 */

import { NextResponse } from "next/server"

/**
 * Handle API request with consistent response format
 */
export async function handleApiRequest<T>(handler: () => Promise<T>): Promise<NextResponse> {
  try {
    const result = await handler()

    // Ensure we always return a valid JSON object
    if (result === undefined || result === null) {
      return NextResponse.json({ success: true, data: {} })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 })
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(body: any, fields: string[]): void {
  const missingFields = fields.filter((field) => !body[field])
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`)
  }
}

/**
 * Extract user ID from request headers or query parameters
 */
export function extractUserId(request: Request): string {
  // Try to get from URL
  const url = new URL(request.url)
  const userId = url.searchParams.get("userId")

  if (userId) {
    return userId
  }

  // Try to get from headers
  const authHeader = request.headers.get("Authorization")
  if (authHeader) {
    // Extract user ID from token or other auth mechanism
    // This is a placeholder - implement actual extraction logic
    return "user-from-auth-header"
  }

  throw new Error("User ID not found in request")
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data: data || {} }, { status })
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(error: Error | string, status = 400): NextResponse {
  const message = typeof error === "string" ? error : error.message
  return NextResponse.json({ success: false, error: message }, { status })
}
