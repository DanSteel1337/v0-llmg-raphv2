/**
 * Document Retry Processing API Route
 *
 * Handles retrying document processing for failed documents.
 * Provides functionality to retry processing when initial processing fails.
 *
 * Features:
 * - Retry processing for failed documents
 * - Status tracking and updates
 * - Streaming progress updates
 * - Support for both blob-based and legacy path-based documents
 * - Proper error handling and recovery
 *
 * Dependencies:
 * - @/lib/document-service for document operations
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/utils/logger for logging
 *
 * @module app/api/documents/retry/route
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { ValidationError, withErrorHandling } from "@/utils/errorHandling"
import { documentService } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"
export const dynamic = "force-dynamic" // Prevent caching

/**
 * Validates document ID format
 *
 * @param id - Document ID to validate
 * @returns True if valid, false otherwise
 */
function isValidDocumentId(id: string): boolean {
  return id.startsWith("doc_") && id.length > 5
}

/**
 * Extracts and validates user ID from request
 *
 * @param request - Next.js request object
 * @returns User ID if found and valid
 * @throws ValidationError if user ID is missing or invalid
 */
async function getUserIdFromRequest(request: NextRequest): Promise<string> {
  // Try to get from headers first
  const userId = request.headers.get("x-user-id")

  if (!userId) {
    // Try to get from query parameters
    const url = new URL(request.url)
    const queryUserId = url.searchParams.get("userId")

    if (!queryUserId) {
      throw new ValidationError("User ID is required", 401)
    }

    return queryUserId
  }

  return userId
}

/**
 * Checks if user has access to the document
 *
 * @param userId - User ID to check
 * @param documentId - Document ID to check access for
 * @returns True if user has access, false otherwise
 */
async function hasDocumentAccess(userId: string, documentId: string): Promise<boolean> {
  try {
    // Get document to check ownership
    const document = await documentService.getDocument(documentId)

    if (!document) {
      return false
    }

    // Check if user is the owner
    return document.user_id === userId
  } catch (error) {
    logger.error(`Error checking document access: ${documentId}`, {
      userId,
      documentId,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return false
  }
}

/**
 * Streams a progress update to the client
 *
 * @param controller - ReadableStreamDefaultController to write to
 * @param data - Data to stream
 */
function streamUpdate(controller: ReadableStreamDefaultController, data: any) {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"))
}

/**
 * POST handler for retrying document processing
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Check if streaming is requested
  const { searchParams } = new URL(request.url)
  const streamResponse = searchParams.get("stream") === "true"

  if (streamResponse) {
    // Handle streaming response
    return handleStreamingRetry(request)
  } else {
    // Handle standard response
    return handleApiRequest(async () => {
      const body = await request.json()
      const { documentId } = body

      if (!documentId) {
        throw new ValidationError("Document ID is required", 400)
      }

      if (!isValidDocumentId(documentId)) {
        throw new ValidationError(`Invalid document ID format: ${documentId}`, 400)
      }

      logger.info(`POST /api/documents/retry - Retrying document processing`, { documentId })

      // Get user ID from request
      const userId = await getUserIdFromRequest(request)

      // Check if document exists and user has access
      const document = await documentService.getDocument(documentId)

      if (!document) {
        logger.warn(`POST /api/documents/retry - Document not found`, { documentId })
        throw new ValidationError(`Document not found: ${documentId}`, 404)
      }

      // Check if user has access to the document
      if (document.user_id !== userId) {
        logger.warn(`POST /api/documents/retry - Unauthorized access attempt`, {
          userId,
          documentOwnerId: document.user_id,
        })
        throw new ValidationError("You don't have permission to retry this document", 403)
      }

      // Check if document is in a valid state for retry
      if (document.status !== "failed" && document.status !== "processing") {
        logger.warn(`POST /api/documents/retry - Document not in a valid state for retry`, {
          documentId,
          status: document.status,
        })
        throw new ValidationError(`Document is not in a valid state for retry. Current status: ${document.status}`, 400)
      }

      // Update document status to processing
      await documentService.updateDocumentStatus(documentId, "processing", 0, "Retrying document processing")

      // Start retry processing asynchronously
      // We don't await this to avoid timeout issues
      documentService
        .retryProcessing(documentId)
        .then((result) => {
          logger.info(`POST /api/documents/retry - Document processing completed`, {
            documentId,
            status: result.status,
            totalChunks: result.totalChunks,
            successfulChunks: result.successfulChunks,
          })
        })
        .catch((error) => {
          logger.error(`POST /api/documents/retry - Error processing document`, {
            documentId,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        })

      logger.info(`POST /api/documents/retry - Document processing started`, { documentId })
      return { success: true, status: "processing" }
    }, request)
  }
})

/**
 * Handle streaming retry response
 *
 * @param request - Next.js request object
 * @returns Streaming response
 */
async function handleStreamingRetry(request: NextRequest): Promise<Response> {
  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json()
        const { documentId } = body

        if (!documentId) {
          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: "Document ID is required",
          })
          controller.close()
          return
        }

        if (!isValidDocumentId(documentId)) {
          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: `Invalid document ID format: ${documentId}`,
          })
          controller.close()
          return
        }

        logger.info(`POST /api/documents/retry (streaming) - Retrying document processing`, { documentId })

        // Get user ID from request
        let userId
        try {
          userId = await getUserIdFromRequest(request)
        } catch (error) {
          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: error instanceof Error ? error.message : "Authentication required",
          })
          controller.close()
          return
        }

        // Initial progress update
        streamUpdate(controller, {
          type: "progress",
          status: "validating",
          progress: 0,
          message: "Validating document...",
        })

        // Check if document exists and user has access
        const document = await documentService.getDocument(documentId)

        if (!document) {
          logger.warn(`POST /api/documents/retry (streaming) - Document not found`, { documentId })
          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: `Document not found: ${documentId}`,
          })
          controller.close()
          return
        }

        // Check if user has access to the document
        if (document.user_id !== userId) {
          logger.warn(`POST /api/documents/retry (streaming) - Unauthorized access attempt`, {
            userId,
            documentOwnerId: document.user_id,
          })
          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: "You don't have permission to retry this document",
          })
          controller.close()
          return
        }

        // Check if document is in a valid state for retry
        if (document.status !== "failed" && document.status !== "processing") {
          logger.warn(`POST /api/documents/retry (streaming) - Document not in a valid state for retry`, {
            documentId,
            status: document.status,
          })
          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: `Document is not in a valid state for retry. Current status: ${document.status}`,
          })
          controller.close()
          return
        }

        // Stream validation success
        streamUpdate(controller, {
          type: "progress",
          status: "validated",
          progress: 10,
          message: "Document validated successfully",
        })

        // Update document status to processing
        await documentService.updateDocumentStatus(documentId, "processing", 0, "Retrying document processing")

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

        logger.info(`POST /api/documents/retry (streaming) - Starting document processing`, {
          documentId,
          fileUrl,
          fileName: document.name,
          fileType: document.file_type,
        })

        // Stream processing started
        streamUpdate(controller, {
          type: "progress",
          status: "processing",
          progress: 20,
          message: "Starting document processing...",
          details: {
            documentId,
            fileName: document.name,
            fileType: document.file_type,
          },
        })

        try {
          // Process the document with progress tracking
          const result = await documentService.retryProcessing(documentId, {
            onProgress: (progress) => {
              // Stream progress updates
              streamUpdate(controller, {
                type: "progress",
                status: progress.stage,
                progress: progress.progress,
                message: progress.message,
                details: progress.details,
              })
            },
          })

          // Stream completion
          streamUpdate(controller, {
            type: "complete",
            status: "indexed",
            progress: 100,
            message: "Document processing complete",
            result: {
              status: result.status,
              totalChunks: result.totalChunks,
              successfulChunks: result.successfulChunks,
              failedChunks: result.failedChunks,
              processingTime: result.processingTime,
            },
          })
        } catch (error) {
          logger.error(`POST /api/documents/retry (streaming) - Error processing document`, {
            documentId,
            error: error instanceof Error ? error.message : "Unknown error",
          })

          // Stream error
          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: error instanceof Error ? error.message : "Unknown error in document processing",
          })
        }

        // Close the stream
        controller.close()
      } catch (error) {
        logger.error("Error in document retry streaming", {
          error: error instanceof Error ? error.message : "Unknown error",
        })

        // Stream error and close
        streamUpdate(controller, {
          type: "error",
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown error in document retry",
        })
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
