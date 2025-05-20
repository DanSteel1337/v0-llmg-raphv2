/**
 * Document Upload API Route
 *
 * API endpoint for uploading document files.
 *
 * Dependencies:
 * - @/services/document-service for document operations
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { validateRequiredFields } from "@/utils/validation"
import { uploadFile } from "@/services/document-service"

export const runtime = "edge"

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const formData = await request.formData()
      const file = formData.get("file") as File
      const userId = formData.get("userId") as string
      const documentId = formData.get("documentId") as string
      const filePath = formData.get("filePath") as string

      console.log(`POST /api/documents/upload - Uploading file`, {
        documentId,
        userId,
        filePath,
        fileName: file?.name,
        fileSize: file?.size,
      })

      // Validate all required fields
      validateRequiredFields(
        { file, userId, documentId, filePath },
        ["file", "userId", "documentId", "filePath"],
        "Document upload",
      )

      // Upload and persist the file
      const result = await uploadFile(userId, file, documentId, filePath)

      console.log(`POST /api/documents/upload - File uploaded successfully`, {
        documentId,
        filePath,
        success: result.success,
      })

      return {
        success: true,
        documentId,
        filePath,
      }
    } catch (error) {
      console.error("POST /api/documents/upload - Error uploading file", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
      })
      throw error
    }
  }, request)
})
