/**
 * Document API Route
 *
 * API endpoints for managing a specific document.
 *
 * Dependencies:
 * - @/services/document-service for document operations
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { getDocumentById, deleteDocument, updateDocumentStatus } from "@/services/document-service"
import { handleApiRequest } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest, { params }: { params: { id: string } }) => {
  return handleApiRequest(async () => {
    const document = await getDocumentById(params.id)

    if (!document) {
      throw new Error("Document not found")
    }

    return { document }
  })
})

export const DELETE = withErrorHandling(async (request: NextRequest, { params }: { params: { id: string } }) => {
  return handleApiRequest(async () => {
    await deleteDocument(params.id)
    return { success: true }
  })
})

export const PATCH = withErrorHandling(async (request: NextRequest, { params }: { params: { id: string } }) => {
  return handleApiRequest(async () => {
    const body = await request.json()
    const { status, progress, errorMessage } = body

    const document = await updateDocumentStatus(params.id, status, progress, errorMessage)
    return { document }
  })
})
