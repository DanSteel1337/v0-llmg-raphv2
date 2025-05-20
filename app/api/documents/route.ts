/**
 * Documents API Route
 *
 * Handles document creation and retrieval operations.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/validation for input validation
 * - @/services/documents for document operations
 * - @/lib/utils/logger for logging
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { ValidationError, validateRequiredFields } from "@/utils/validation"
import { createDocument } from "@/services/documents"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const userId = searchParams.get("userId")

      logger.info(`GET /api/documents - Fetching documents`, { userId })

      if (!userId) {
        throw new ValidationError("User ID is required")
      }

      // In a real implementation, you would fetch documents from Pinecone
      // For now, return an empty array
      return { documents: [] }
    } catch (error) {
      logger.error("GET /api/documents - Error fetching documents", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const body = await request.json()
      logger.info(`POST /api/documents - Creating document`, {
        userId: body.userId,
        name: body.name,
      })

      validateRequiredFields(body, ["userId", "name", "fileType", "fileSize", "filePath"], "Document creation")
      const { userId, name, description, fileType, fileSize, filePath } = body

      // Call the document service to create the document
      const document = await createDocument({
        userId,
        name,
        fileType,
        fileSize,
        filePath,
      })

      // Validate document before proceeding
      if (!document?.id || typeof document.id !== "string") {
        logger.error("POST /api/documents - Invalid document response", { document })
        throw new Error("Failed to create document: Invalid document format")
      }

      logger.info(`POST /api/documents - Successfully created document`, {
        userId,
        documentId: document.id,
        filePath: document.file_path,
      })

      // Return the document object with a 200 status
      return { document }
    } catch (error) {
      logger.error("POST /api/documents - Error creating document", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
