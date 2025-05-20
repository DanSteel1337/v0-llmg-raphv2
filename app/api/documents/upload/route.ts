/**
 * Document Upload API Route
 *
 * Handles file uploads via FormData and stores them in Vercel Blob Storage.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/validation for input validation
 * - @/lib/utils/logger for logging
 * - @vercel/blob for blob storage operations
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { ValidationError } from "@/utils/validation"
import { logger } from "@/lib/utils/logger"
import { put } from "@vercel/blob"

export const runtime = "edge"

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const formData = await request.formData()
      const file = formData.get("file") as File
      const userId = formData.get("userId") as string
      const documentId = formData.get("documentId") as string
      const filePath = formData.get("filePath") as string

      logger.info(`POST /api/documents/upload - Processing upload request`, {
        documentId,
        userId,
        filePath,
        fileName: file?.name,
        fileSize: file?.size,
      })

      // Validate all required fields
      if (!file) {
        throw new ValidationError("File is required")
      }

      if (!userId) {
        throw new ValidationError("User ID is required")
      }

      if (!documentId) {
        throw new ValidationError("Document ID is required")
      }

      if (!filePath) {
        throw new ValidationError("File path is required")
      }

      // Upload to Vercel Blob Storage
      const fileBuffer = await file.arrayBuffer()
      const blobPath = `documents/${userId}/${documentId}/${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

      logger.info(`POST /api/documents/upload - Uploading to Vercel Blob`, {
        documentId,
        blobPath,
        contentType: file.type || "text/plain",
        fileSize: file.size,
      })

      const blob = await put(blobPath, fileBuffer, {
        access: "public", // Public read access as per requirements
        contentType: file.type || "text/plain",
        addRandomSuffix: false, // Use exact path for consistency
        metadata: {
          userId,
          documentId,
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      })

      logger.info(`POST /api/documents/upload - File uploaded successfully to Vercel Blob`, {
        documentId,
        blobUrl: blob.url,
        fileSize: blob.size,
      })

      // Return the blob URL for processing
      return {
        success: true,
        documentId,
        filePath: blobPath,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: blob.url, // Return the actual blob URL
        blobUrl: blob.url, // Include both for backward compatibility
      }
    } catch (error) {
      logger.error("POST /api/documents/upload - Error uploading file", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
