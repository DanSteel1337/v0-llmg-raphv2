/**
 * Document Processing API Route
 *
 * API endpoint for processing documents.
 *
 * Dependencies:
 * - @/services/document-service for document processing
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { processDocument } from "@/services/document-service"
import { handleApiRequest } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

export const runtime = "edge"

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()
    const { documentId, userId, filePath, fileName, fileType, fileUrl } = body

    if (!documentId) {
      throw new Error("Document ID is required")
    }

    if (!userId) {
      throw new Error("User ID is required")
    }

    if (!filePath) {
      throw new Error("File path is required")
    }

    if (!fileName) {
      throw new Error("File name is required")
    }

    if (!fileType) {
      throw new Error("File type is required")
    }

    if (!fileUrl) {
      throw new Error("File URL is required")
    }

    const success = await processDocument({
      documentId,
      userId,
      filePath,
      fileName,
      fileType,
      fileUrl,
    })

    return { success }
  })
})
