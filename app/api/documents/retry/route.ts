/**
 * Document Retry Processing API Route
 *
 * Handles retrying document processing for failed documents.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/document-service for document operations
 * - @/lib/utils/logger for logging
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { getDocumentById, processDocument, updateDocumentStatus } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

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

      // Process the document asynchronously
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
      })

      logger.info(`POST /api/documents/retry - Document processing started`, { documentId })
      return { success: true, status: "processing" }
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
