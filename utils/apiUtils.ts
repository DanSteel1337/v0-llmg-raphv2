/**
 * API Utilities
 *
 * Common utilities for API operations.
 */

import { NextResponse } from "next/server"

/**
 * Wrap an API handler with standardized error handling
 */
export function withErrorHandling<T>(handler: () => Promise<T>): Promise<NextResponse> {
  return handleApiRequest(handler)
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
 * Create a new document record
 */
export async function createDocument(
  userId: string,
  name: string,
  fileType: string,
  fileSize: number,
  filePath: string,
): Promise<Document> {
  // This is a placeholder - implement actual document creation logic
  // In a real implementation, this would call an API or database
  return {
    id: `doc-${Date.now()}`,
    name,
    file_path: filePath,
    file_type: fileType,
    file_size: fileSize,
    user_id: userId,
    created_at: new Date().toISOString(),
    status: "pending",
  }
}

// Type definition for Document
interface Document {
  id: string
  name: string
  file_path: string
  file_type: string
  file_size: number
  user_id: string
  created_at: string
  status: string
  [key: string]: any
}
