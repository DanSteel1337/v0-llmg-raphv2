export const runtime = "edge"

// Update maxDuration to be within the valid range (1-60 seconds)
export const maxDuration = 60

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { processDocument } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"

/**
 * POST handler for document processing
 * Validates inputs and triggers asynchronous document processing
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()
    const { documentId, userId, filePath, fileName, fileType, fileUrl } = body

    // Validate required fields
    if (!documentId) {
      return { success: false, error: "Document ID is required" }
    }

    if (!userId) {
      return { success: false, error: "User ID is required" }
    }

    if (!filePath) {
      return { success: false, error: "File path is required" }
    }

    if (!fileName) {
      return { success: false, error: "File name is required" }
    }

    if (!fileUrl) {
      return { success: false, error: "File URL is required" }
    }

    logger.info(`POST /api/documents/process - Processing document`, {
      documentId,
      userId,
      filePath,
      fileName,
      fileType,
      fileUrl: fileUrl.substring(0, 100) + (fileUrl.length > 100 ? "..." : ""),
    })

    // Process the document asynchronously
    processDocument({
      documentId,
      userId,
      filePath,
      fileName,
      fileType: fileType || "text/plain",
      fileUrl,
    }).catch((error) => {
      logger.error(`POST /api/documents/process - Error processing document`, {
        documentId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
    })

    logger.info(`POST /api/documents/process - Document processing started`, { documentId })
    return { success: true, status: "processing" }
  }, request)
})
