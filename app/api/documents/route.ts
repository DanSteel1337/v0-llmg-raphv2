/**
 * Documents API Route
 *
 * API endpoints for managing documents.
 *
 * Dependencies:
 * - @/services/document-service for document operations
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { getDocumentsByUserId, createDocument } from "@/services/document-service"
import { handleApiRequest, validateRequiredFields } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

// Ensure the Edge runtime is declared
export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      throw new Error("User ID is required")
    }

    const documents = await getDocumentsByUserId(userId)
    return { documents }
  })
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()

    validateRequiredFields(body, ["userId", "name", "fileType", "fileSize", "filePath"])
    const { userId, name, description, fileType, fileSize, filePath } = body

    const document = await createDocument(userId, name, description, fileType, fileSize, filePath)
    return { document }
  })
})
