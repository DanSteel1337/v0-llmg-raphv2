/**
 * Documents API Route
 *
 * Handles document creation and retrieval.
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
import { createDocument, getDocumentsByUserId } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return { success: false, error: "User ID is required" }
    }

    logger.info(`GET /api/documents - Fetching documents for user`, { userId })

    const documents = await getDocumentsByUserId(userId)

    logger.info(`GET /api/documents - Found ${documents.length} documents for user`, { userId })
    return { success: true, documents }
  }, request)
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()
    const { userId, name, description, fileType, fileSize, filePath } = body

    if (!userId) {
      return { success: false, error: "User ID is required" }
    }

    if (!name) {
      return { success: false, error: "Document name is required" }
    }

    logger.info(`POST /api/documents - Creating document`, {
      userId,
      name,
      fileType,
      fileSize,
    })

    const document = await createDocument(userId, name, description, fileType, fileSize, filePath)

    logger.info(`POST /api/documents - Document created successfully`, {
      documentId: document.id,
      userId,
    })

    return { success: true, document }
  }, request)
})
