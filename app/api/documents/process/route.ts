/**
 * Document Processing API Route
 *
 * Handles document processing operations including text extraction,
 * chunking, embedding generation, and vector storage.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/validation for input validation
 * - @/lib/utils/logger for logging
 * - @/lib/document-service for document processing
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { validateRequiredFields } from "@/utils/validation"
import { logger } from "@/lib/utils/logger"
import { processDocument } from "@/lib/document-service"
import { NextResponse } from "next/server"

export const runtime = "edge"

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      // Log the start of document processing
      logger.info(`POST /api/documents/process - Starting document processing`)

      // Parse the request body
      const body = await request.json().catch((error) => {
        logger.error(`POST /api/documents/process - Failed to parse request body`, { error })
        return {}
      })

      // Validate required fields
      try {
        validateRequiredFields(
          body,
          ["documentId", "userId", "filePath", "fileName", "fileType", "fileUrl"],
          "Document processing",
        )
      } catch (validationError) {
        logger.error(`POST /api/documents/process - Validation error`, {
          error: validationError instanceof Error ? validationError.message : "Unknown validation error",
          body: JSON.stringify(body),
        })
        return NextResponse.json(
          {
            success: false,
            error: validationError instanceof Error ? validationError.message : "Validation error",
          },
          { status: 400 },
        )
      }

      const { documentId, userId, filePath, fileName, fileType, fileUrl } = body

      logger.info(`POST /api/documents/process - Processing document`, {
        documentId,
        userId,
        filePath,
        fileName,
        fileType,
      })

      // Verify file is accessible before processing
      try {
        logger.info(`POST /api/documents/process - Checking file accessibility`, { fileUrl })

        const fileResponse = await fetch(fileUrl)

        if (!fileResponse.ok) {
          logger.error(`POST /api/documents/process - File not found at URL: ${fileUrl}`, {
            status: fileResponse.status,
            statusText: fileResponse.statusText,
          })

          // Return 404 if file not found as required
          return NextResponse.json(
            {
              success: false,
              documentId,
              status: "failed",
              error: "Document file not found (404)",
            },
            { status: 404 },
          )
        }

        // File exists, process it asynchronously
        // This is important because document processing can take time
        // and we don't want to block the response
        logger.info(`POST /api/documents/process - File accessible, starting background processing`, { documentId })

        // Start processing in the background
        processDocument({
          documentId,
          userId,
          filePath,
          fileName,
          fileType,
          fileUrl,
        }).catch((processingError) => {
          logger.error(`Error in background document processing`, {
            documentId,
            error: processingError instanceof Error ? processingError.message : "Unknown error",
          })
        })

        logger.info(`POST /api/documents/process - Document processing started`, {
          documentId,
          userId,
          filePath,
        })

        // Return success response
        return {
          success: true,
          documentId,
          status: "processing",
          message: "Document processing started",
        }
      } catch (fetchError) {
        logger.error(`POST /api/documents/process - Error fetching file`, {
          documentId,
          fileUrl,
          error: fetchError instanceof Error ? fetchError.message : "Unknown error",
        })

        return NextResponse.json(
          {
            success: false,
            documentId,
            status: "failed",
            error: "Error accessing document file",
          },
          { status: 500 },
        )
      }
    } catch (error) {
      logger.error(`POST /api/documents/process - Error processing document`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
