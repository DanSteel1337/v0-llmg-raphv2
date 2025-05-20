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
import { processDocument, updateDocumentStatus } from "@/services/document-service"
import { handleApiRequest } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

export const runtime = "edge"

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()
    const { documentId, userId, filePath, fileName, fileType, fileUrl } = body

    console.log(`POST /api/documents/process - Processing document`, {
      documentId,
      userId,
      filePath,
      fileName,
      fileType,
    })

    // Validate required fields
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

    try {
      // Update document status to processing
      await updateDocumentStatus(documentId, "processing", 5, "Starting document processing")
      console.log(`POST /api/documents/process - Updated document status to processing`, { documentId })

      // Verify file is accessible before processing
      try {
        const fileResponse = await fetch(fileUrl)
        if (!fileResponse.ok) {
          console.error(`POST /api/documents/process - File not found at URL: ${fileUrl}`, {
            status: fileResponse.status,
            statusText: fileResponse.statusText,
          })

          await updateDocumentStatus(documentId, "failed", 0, `File not found: ${fileResponse.statusText}`)

          return {
            success: false,
            documentId,
            status: "failed",
            error: "Document file not found (404)",
          }
        }
      } catch (fetchError) {
        console.error(`POST /api/documents/process - Error fetching file`, {
          documentId,
          fileUrl,
          error: fetchError instanceof Error ? fetchError.message : "Unknown error",
        })

        await updateDocumentStatus(
          documentId,
          "failed",
          0,
          `Error accessing file: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
        )

        return {
          success: false,
          documentId,
          status: "failed",
          error: "Error accessing document file",
        }
      }

      // Process the document
      const result = await processDocument({
        documentId,
        userId,
        filePath,
        fileName,
        fileType,
        fileUrl,
      })

      if (result.success) {
        console.log(`POST /api/documents/process - Document processing completed successfully`, {
          documentId,
          chunksProcessed: result.chunksProcessed,
          vectorsInserted: result.vectorsInserted,
        })

        // Update document status to complete
        await updateDocumentStatus(
          documentId,
          "indexed",
          100,
          `Document processed successfully: ${result.vectorsInserted} vectors inserted from ${result.chunksProcessed} chunks`,
        )

        return {
          success: true,
          documentId,
          status: "indexed",
          chunksProcessed: result.chunksProcessed,
          vectorsInserted: result.vectorsInserted,
        }
      } else {
        console.error(`POST /api/documents/process - Document processing failed`, {
          documentId,
          error: result.error,
        })

        // Update document status to failed
        await updateDocumentStatus(documentId, "failed", 0, `Processing failed: ${result.error}`)

        return {
          success: false,
          documentId,
          status: "failed",
          error: result.error,
        }
      }
    } catch (error) {
      console.error(`POST /api/documents/process - Error processing document`, {
        documentId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })

      // Update document status to failed
      await updateDocumentStatus(
        documentId,
        "failed",
        0,
        `Processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
      )

      throw error
    }
  })
})
