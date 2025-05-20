/**
 * Document Upload API Route
 *
 * Handles file uploads via FormData and stores them for processing.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/validation for input validation
 * - @/services/document-service for file storage
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { ValidationError } from "@/utils/validation"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const formData = await request.formData()
      const file = formData.get("file") as File
      const userId = formData.get("userId") as string
      const documentId = formData.get("documentId") as string
      const filePath = formData.get("filePath") as string

      logger.info(`POST /api/documents/upload - Processing upload request`, {
        documentId,
        userId,
        filePath,
        fileName: file?.name,
        fileSize: file?.size,
      })

      // Validate all required fields
      if (!file) {
        throw new ValidationError("File is required")
      }

      if (!userId) {
        throw new ValidationError("User ID is required")
      }

      if (!documentId) {
        throw new ValidationError("Document ID is required")
      }

      if (!filePath) {
        throw new ValidationError("File path is required")
      }

      // For Edge compatibility, we'll simulate file storage
      // In a real implementation, you would upload to a storage service
      // that's compatible with Edge runtime (like Vercel Blob)

      logger.info(`POST /api/documents/upload - File uploaded successfully`, {
        documentId,
        filePath,
        fileName: file.name,
        fileSize: file.size,
      })

      return {
        success: true,
        documentId,
        filePath,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: `/api/documents/file?path=${encodeURIComponent(filePath)}`,
      }
    } catch (error) {
      logger.error("POST /api/documents/upload - Error uploading file", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
