// Info: Utilities for API response handling with consistent patterns
import { NextResponse } from "next/server"
import type { ApiError, ApiSuccess } from "@/types"

/**
 * Creates a standardized error response
 * @param message Error message
 * @param status HTTP status code
 * @param details Additional error details
 * @param code Error code for client-side handling
 */
export function createErrorResponse(
  message: string,
  status = 500,
  details?: unknown,
  code?: string,
): NextResponse<ApiError> {
  console.error(`API Error (${status}): ${message}`, details)

  return NextResponse.json(
    {
      error: message,
      ...(details && { details }),
      ...(code && { code }),
    },
    { status },
  )
}

/**
 * Creates a standardized success response
 * @param data Response data
 * @param status HTTP status code
 */
export function createSuccessResponse<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status },
  )
}

/**
 * Handles API requests with consistent error handling
 * @param requestHandler Async function that handles the request
 */
export async function handleApiRequest<T>(
  requestHandler: () => Promise<T>,
): Promise<NextResponse<ApiSuccess<T> | ApiError>> {
  try {
    const result = await requestHandler()
    return createSuccessResponse(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred"
    const code = error instanceof Error && "code" in error ? (error as any).code : undefined
    return createErrorResponse(message, 500, undefined, code)
  }
}

/**
 * Validates required fields in a request body
 * @param body Request body
 * @param requiredFields Array of required field names
 * @throws Error if any required field is missing
 */
export function validateRequiredFields(body: Record<string, any>, requiredFields: string[]): void {
  const missingFields = requiredFields.filter((field) => body[field] === undefined)

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`)
  }
}

/**
 * Extracts and validates a user ID from request parameters
 * @param request Next.js request object
 * @throws Error if user ID is missing
 */
export function extractUserId(request: Request): string {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    throw new Error("User ID is required")
  }

  return userId
}
