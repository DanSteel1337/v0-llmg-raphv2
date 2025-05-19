/**
 * API Utilities
 *
 * Common utilities for API routes.
 */

import { NextResponse } from "next/server"

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandling(handler: Function) {
  return async (req: Request, ...args: any[]) => {
    try {
      return await handler(req, ...args)
    } catch (error) {
      console.error("API error:", error)
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
    }
  }
}

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
 * Create a document
 */
export async function createDocument(
  userId: string,
  name: string,
  description?: string,
  fileType?: string,
  fileSize?: number,
  filePath?: string,
): Promise<any> {
  // This is a placeholder implementation
  // In a real application, you would call your document service
  return {
    id: "doc-123",
    user_id: userId,
    name,
    description: description || "",
    file_type: fileType || "text/plain",
    file_size: fileSize || 0,
    file_path: filePath || "",
    status: "processing",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
