/**
 * Document Processing API Route
 *
 * Handles document processing requests, including text extraction, chunking,
 * and embedding generation. Initiates asynchronous processing of document content.
 *
 * Features:
 * - Document content extraction and processing
 * - Asynchronous processing with status updates
 * - Validation of required parameters
 * - Proper error handling and logging
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
import { processDocument, updateDocumentStatus } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

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

    // Update document status to processing immediately to prevent "stuck at 0%" issues
    try {
      await updateDocumentStatus(documentId, "processing", 5, "Starting document processing", {
        processingStartTime: new Date().toISOString(),
        processingTriggered: true,
      })
    } catch (statusError) {
      logger.error(`Failed to update initial document status`, {
        documentId,
        error: statusError instanceof Error ? statusError.message : String(statusError),
      })
      // Continue even if initial status update fails
    }

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

      // Update document status to failed if processing fails
      updateDocumentStatus(
        documentId,
        "failed",
        0,
        error instanceof Error ? error.message : "Unknown processing error",
        { processingError: true },
      ).catch((statusError) => {
        logger.error(`Failed to update document status after error`, {
          documentId,
          error: statusError instanceof Error ? statusError.message : String(statusError),
        })
      })
    })

    logger.info(`POST /api/documents/process - Document processing started`, { documentId })
    return { success: true, status: "processing" }
  }, request)
})
