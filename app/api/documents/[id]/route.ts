/**
 * Document API Route - Document Operations
 *
 * Handles operations on individual documents including deletion.
 * Provides endpoints for document management with proper error handling
 * and cleanup of associated resources.
 * 
 * Features:
 * - Document deletion with cleanup
 * - Associated blob storage cleanup
 * - Vector data removal from Pinecone
 * - Proper error handling and logging
 * 
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/document-service for document operations
 * - @/lib/utils/logger for logging
 * - @vercel/blob for blob storage operations
 * 
 * @module app/api/documents/[id]/route
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { deleteDocument, getDocumentById } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"
import { del, list } from "@vercel/blob"

export const runtime = "edge"

/**
 * DELETE handler for document deletion
 * Removes the document, associated vectors, and blob files
 */
export const DELETE = withErrorHandling(async (request: NextRequest, { params }: { params: { id: string } }) => {
  return handleApiRequest(async () => {
    const documentId = params.id

    if (!documentId) {
      return { success: false, error: "Document ID is required" }
    }

    logger.info(`DELETE /api/documents/${documentId} - Deleting document`)

    try {
      // Get document details before deletion
      const document = await getDocumentById(documentId)

      if (!document) {
        logger.warn(`DELETE /api/documents/${documentId} - Document not found`)
        return { success: false, error: "Document not found" }
      }

      // Delete document vectors from Pinecone
      await deleteDocument(documentId)

      // Try to delete associated blob files
      try {
        // First try to find blobs with document ID in the path
        const blobPrefix = `documents/${document.user_id}/${documentId}/`
        const blobs = await list({ prefix: blobPrefix })

        if (blobs.blobs.length > 0) {
          logger.info(`DELETE /api/documents/${documentId} - Deleting ${blobs.blobs.length} blob files`, {
            blobPrefix,
            blobCount: blobs.blobs.length,
          })

          // Delete each blob
          for (const blob of blobs.blobs) {
            await del(blob.url)
            logger.info(`DELETE /api/documents/${documentId} - Deleted blob`, { url: blob.url })
          }
        } else {
          logger.info(`DELETE /api/documents/${documentId} - No blob files found with prefix`, { blobPrefix })
        }
      } catch (blobError) {
        // Log but don't fail if blob deletion has issues
        logger.warn(`DELETE /api/documents/${documentId} - Error deleting blob files`, {
          error: blobError instanceof Error ? blobError.message : "Unknown error",
        })
      }

      logger.info(`DELETE /api/documents/${documentId} - Document deleted successfully`)
      return { success: true }
    } catch (error) {
      logger.error(`DELETE /api/documents/${documentId} - Error deleting document`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
