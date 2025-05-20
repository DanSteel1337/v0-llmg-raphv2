// app/api/documents/process/route.ts

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { processDocument } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"
export const maxDuration = 60 // 60 seconds max duration for Edge function

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    // Parse the request body
    const body = await request.json()
    const { documentId, userId, filePath, fileName, fileType, fileUrl } = body

    // Validate required fields
    if (!documentId) {
      return { success: false, error: "Document ID is required" }
    }

    if (!userId) {
      return { success: false, error: "User ID is required" }
    }

    if (!filePath) {
      return { success: false, error: "File path is required" }
    }

    if (!fileName) {
      return { success: false, error: "File name is required" }
    }

    if (!fileUrl) {
      return { success: false, error: "File URL is required" }
    }

    logger.info(`POST /api/documents/process - Processing document`, {
      documentId,
      userId,
      filePath,
      fileName,
      fileType,
    })

    // Start processing the document asynchronously
    // This is done asynchronously with a detached Promise to avoid 
    // blocking the response while processing runs in the background
    const processingPromise = processDocument({
      documentId,
      userId,
      filePath,
      fileName,
      fileType: fileType || "text/plain",
      fileUrl,
    }).catch((error) => {
      logger.error(`POST /api/documents/process - Error processing document`, {
        documentId,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    })

    // Add .catch to prevent unhandled promise rejection
    processingPromise.catch(err => {
      logger.error(`Unhandled error in background processing task:`, {
        error: err instanceof Error ? err.message : "Unknown error",
        documentId
      })
    })

    logger.info(`POST /api/documents/process - Document processing started`, { documentId })
    
    // Return immediate success response while processing continues in the background
    return { 
      success: true, 
      status: "processing",
      message: "Document processing started successfully"
    }
  }, request)
})
