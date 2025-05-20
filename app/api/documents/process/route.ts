/**
 * Document Processing API Route
 *
 * Handles document processing requests, initiating the embedding and indexing pipeline.
 * This route starts the asynchronous processing of documents and returns immediately.
 *
 * Features:
 * - Initiates document processing
 * - Validates input parameters
 * - Handles errors gracefully
 * - Returns processing status
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/document-service for document operations
 * - @/lib/utils/logger for logging
 *
 * @module app/api/documents/process/route
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { processDocument } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"
export const maxDuration = 60 // Maximum duration in seconds (60 is the maximum for Edge functions)

/**
 * POST handler for document processing
 * Initiates the document processing pipeline
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()
    const { documentId, userId, filePath, fileName, fileType, fileUrl } = body

    // Validate required parameters
    if (!documentId) return { success: false, error: "Document ID is required" }
    if (!userId) return { success: false, error: "User ID is required" }
    if (!filePath) return { success: false, error: "File path is required" }
    if (!fileName) return { success: false, error: "File name is required" }
    if (!fileType) return { success: false, error: "File type is required" }
    if (!fileUrl) return { success: false, error: "File URL is required" }

    logger.info(`POST /api/documents/process - Processing document`, {
      documentId,
      userId,
      fileName,
      fileType,
      filePath: filePath.substring(0, 100) + (filePath.length > 100 ? "..." : ""),
      fileUrl: fileUrl.substring(0, 100) + (fileUrl.length > 100 ? "..." : ""),
    })

    try {
      // Start processing in the background without awaiting completion
      processDocument({
        documentId,
        userId,
        filePath,
        fileName,
        fileType,
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
    } catch (error) {
      logger.error(`POST /api/documents/process - Error starting document processing`, {
        documentId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
  }, request)
})
