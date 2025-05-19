/**
 * Documents API Route
 *
 * API endpoints for managing documents.
 *
 * Dependencies:
 * - @/services/document-service for document operations
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { getDocumentsByUserId, createDocument } from "@/services/document-service"
import { handleApiRequest, validateRequiredFields } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

// Ensure the Edge runtime is declared
export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const userId = searchParams.get("userId")

      console.log(`GET /api/documents - Fetching documents for user`, { userId })

      if (!userId) {
        console.error("GET /api/documents - Missing userId parameter")
        throw new Error("User ID is required")
      }

      const documents = await getDocumentsByUserId(userId)
      console.log(`GET /api/documents - Successfully fetched documents`, {
        userId,
        documentCount: documents.length,
      })

      return { documents }
    } catch (error) {
      console.error("GET /api/documents - Error fetching documents", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
      })
      throw error
    }
  })
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const body = await request.json()
      console.log(`POST /api/documents - Creating document`, {
        userId: body.userId,
        name: body.name,
      })

      validateRequiredFields(body, ["userId", "name", "fileType", "fileSize", "filePath"])
      const { userId, name, description, fileType, fileSize, filePath } = body

      const document = await createDocument(userId, name, description, fileType, fileSize, filePath)
      console.log(`POST /api/documents - Successfully created document`, {
        userId,
        documentId: document.id,
      })

      return { document }
    } catch (error) {
      console.error("POST /api/documents - Error creating document", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
      })
      throw error
    }
  })
})
