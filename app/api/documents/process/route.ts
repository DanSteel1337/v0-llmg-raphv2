/**
 * Document Processing API Route
 *
 * Handles the document processing pipeline for the RAG system.
 * This route initiates the processing of uploaded documents including:
 * - Text extraction
 * - Chunking of content
 * - Embedding generation
 * - Vector storage in Pinecone
 * 
 * The actual processing runs asynchronously to avoid Edge function timeouts.
 * 
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/validation for input validation
 * - @/lib/utils/logger for structured logging
 * - @/lib/document-service for document processing logic
 * 
 * @module app/api/documents/process/route
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
      let body;
      try {
        body = await request.json();
      } catch (error) {
        logger.error(`POST /api/documents/process - Failed to parse request body`, { error })
        return NextResponse.json(
          { success: false, error: "Invalid JSON in request body" },
          { status: 400 }
        );
      }

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
        logger.info(`POST /api/documents/process - Checking file accessibility`, { 
          fileUrl,
          documentId 
        })

        const fileResponse = await fetch(fileUrl, {
          method: 'HEAD', // Use HEAD request first to quickly check access
          cache: 'no-store',
        }).catch(error => {
          logger.error(`POST /api/documents/process - Error during file HEAD request`, { 
            error: error instanceof Error ? error.message : "Unknown fetch error",
            fileUrl,
            documentId
          });
          throw error;
        });

        if (!fileResponse.ok) {
          logger.error(`POST /api/documents/process - File not accessible via HEAD request: ${fileUrl}`, {
            status: fileResponse.status,
            statusText: fileResponse.statusText,
            documentId
          })

          // Try a regular GET request as fallback
          const getResponse = await fetch(fileUrl, {
            cache: 'no-store'
          }).catch(error => {
            logger.error(`POST /api/documents/process - Error during file GET request`, { 
              error: error instanceof Error ? error.message : "Unknown fetch error",
              fileUrl,
              documentId
            });
            throw error;
          });

          if (!getResponse.ok) {
            logger.error(`POST /api/documents/process - File not found at URL: ${fileUrl}`, {
              status: getResponse.status,
              statusText: getResponse.statusText,
              documentId
            })

            // Return 404 if file not found as required
            return NextResponse.json(
              {
                success: false,
                documentId,
                status: "failed",
                error: `Document file not found (${getResponse.status})`,
              },
              { status: 404 },
            )
          }
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
            stack: processingError instanceof Error ? processingError.stack : undefined
          })
        })

        logger.info(`POST /api/documents/process - Document processing started`, {
          documentId,
          userId,
          filePath,
        })

        // Return success response with explicit success flag
        return {
          success: true,  // <-- CRITICAL FIX: Explicitly include success flag
          documentId,
          status: "processing",
          message: "Document processing started",
        }
      } catch (fetchError) {
        logger.error(`POST /api/documents/process - Error accessing file`, {
          documentId,
          fileUrl,
          error: fetchError instanceof Error ? fetchError.message : "Unknown error",
          stack: fetchError instanceof Error ? fetchError.stack : undefined
        })

        return NextResponse.json(
          {
            success: false,
            documentId,
            status: "failed",
            error: `Error accessing document file: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
          },
          { status: 500 },
        )
      }
    } catch (error) {
      logger.error(`POST /api/documents/process - Error processing document`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      
      // Return explicit error response with success flag
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred during document processing",
      }
    }
  }, request)
})
