/**
 * Document Retry Processing API Route
 *
 * Handles retrying document processing for failed documents.
 * Provides functionality to retry processing when initial processing fails.
 *
 * Features:
 * - Retry processing for failed documents
 * - Status tracking and updates
 * - Support for both blob-based and legacy path-based documents
 * - Proper error handling and recovery
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/document-service for document operations
 * - @/lib/utils/logger for logging
 *
 * @module app/api/documents/retry/route
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { getDocumentById, processDocument, updateDocumentStatus } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

/**
 * POST handler for retrying document processing
 * Resets document processing state and triggers reprocessing
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return { success: false, error: "Document ID is required" }
    }

    logger.info(`POST /api/documents/retry - Retrying document processing`, { documentId })

    try {
      // Get document details
      const document = await getDocumentById(documentId)

      if (!document) {
        logger.warn(`POST /api/documents/retry - Document not found`, { documentId })
        return { success: false, error: "Document not found" }
      }

      // Update document status to processing
      await updateDocumentStatus(documentId, "processing", 0, "Retrying document processing")

      // Determine the file URL
      // First check if we have a blob_url in the document metadata
      let fileUrl = document.blob_url

      // If no blob_url, construct a path-based URL
      if (!fileUrl) {
        // Check if the file_path looks like a blob path (starts with documents/)
        if (document.file_path && document.file_path.startsWith("documents/")) {
          fileUrl = `/api/documents/file?path=${encodeURIComponent(document.file_path)}`
        } else {
          // Legacy path
          fileUrl = `/api/documents/file?path=${encodeURIComponent(document.file_path)}`
        }
      }

      logger.info(`POST /api/documents/retry - Starting document processing`, {
        documentId,
        fileUrl,
        fileName: document.name,
        fileType: document.file_type,
      })

      // Process the document asynchronously - but handle errors properly
      try {
        // Start processing in the background
        processDocument({
          documentId,
          userId: document.user_id,
          filePath: document.file_path,
          fileName: document.name,
          fileType: document.file_type,
          fileUrl,
          isRetry: true,
        }).catch((error) => {
          logger.error(`POST /api/documents/retry - Error processing document`, {
            documentId,
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          })

          // Update document status to failed if background processing fails
          updateDocumentStatus(
            documentId,
            "failed",
            0,
            `Background processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          ).catch((statusError) => {
            logger.error(`Failed to update document status after error:`, statusError)
          })
        })

        logger.info(`POST /api/documents/retry - Document processing started`, { documentId })
        return { success: true, status: "processing" }
      } catch (processingError) {
        // This catch block handles synchronous errors in starting the process
        logger.error(`POST /api/documents/retry - Error starting document processing`, {
          documentId,
          error: processingError instanceof Error ? processingError.message : "Unknown error",
        })

        // Update document status to failed
        await updateDocumentStatus(
          documentId,
          "failed",
          0,
          `Failed to start processing: ${processingError instanceof Error ? processingError.message : "Unknown error"}`,
        )

        return {
          success: false,
          error: `Failed to start document processing: ${processingError instanceof Error ? processingError.message : "Unknown error"}`,
        }
      }
    } catch (error) {
      logger.error(`POST /api/documents/retry - Error retrying document processing`, {
        documentId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
