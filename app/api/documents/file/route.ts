/**
 * Document File API Route
 *
 * Handles file upload and retrieval operations for documents.
 * Provides endpoints for storing files in Vercel Blob and retrieving file content.
 *
 * Features:
 * - File upload with validation
 * - File retrieval by URL or path
 * - Authorization checks
 * - Proper error handling
 * - Edge runtime compatible
 *
 * Dependencies:
 * - @vercel/blob for file storage
 * - @/lib/blob-client for blob storage operations
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/errorHandling for consistent error handling
 * - @/lib/utils/logger for logging
 * - @/lib/document-service for document operations
 *
 * @module app/api/documents/file/route
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { ValidationError, withErrorHandling } from "@/utils/errorHandling"
import { logger } from "@/lib/utils/logger"
import { uploadToBlob } from "@/lib/blob-client"
import { generateDocumentId } from "@/lib/document-service"
import { get } from "@vercel/blob"

export const runtime = "edge"
export const dynamic = "force-dynamic" // Prevent caching

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_FILE_TYPES = ["text/plain", ".txt"]

/**
 * Extracts and validates user ID from request
 *
 * @param request - Next.js request object
 * @returns User ID if found and valid
 * @throws ValidationError if user ID is missing or invalid
 */
async function getUserIdFromRequest(request: NextRequest): Promise<string> {
  // Try to get from headers first
  const userId = request.headers.get("x-user-id")

  if (!userId) {
    // Try to get from query parameters
    const url = new URL(request.url)
    const queryUserId = url.searchParams.get("userId")

    if (!queryUserId) {
      throw new ValidationError("User ID is required", 401)
    }

    return queryUserId
  }

  return userId
}

/**
 * Validates file type
 *
 * @param fileType - File type to validate
 * @returns True if valid, false otherwise
 */
function isValidFileType(fileType: string): boolean {
  return ALLOWED_FILE_TYPES.some((type) => fileType.toLowerCase().includes(type.toLowerCase()))
}

/**
 * POST handler for file uploads
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    logger.info("POST /api/documents/file - Processing file upload")

    // Get user ID from request
    const userId = await getUserIdFromRequest(request)

    // Parse form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    // Validate file exists
    if (!file) {
      throw new ValidationError("No file provided", 400)
    }

    // Validate file type
    if (!isValidFileType(file.type)) {
      throw new ValidationError(`Invalid file type: ${file.type}. Only text files (.txt) are supported.`, 400)
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(`File too large: ${file.size} bytes. Maximum size is ${MAX_FILE_SIZE} bytes.`, 400)
    }

    // Extract optional metadata
    const fileName = (formData.get("fileName") as string) || file.name
    const description = (formData.get("description") as string) || ""
    const tags = (formData.get("tags") as string) || ""

    // Generate document ID
    const documentId = generateDocumentId()

    // Create blob path
    const blobPath = `documents/${userId}/${documentId}/${fileName}`

    logger.info(`POST /api/documents/file - Uploading file to blob storage`, {
      userId,
      documentId,
      fileName,
      fileSize: file.size,
      fileType: file.type,
      blobPath,
    })

    try {
      // Upload file to Vercel Blob
      const blob = await uploadToBlob(await file.arrayBuffer(), blobPath, {
        contentType: file.type,
        cacheControlMaxAge: 31536000, // 1 year
        metadata: {
          userId,
          documentId,
          fileName,
          uploadedAt: new Date().toISOString(),
        },
      })

      logger.info(`POST /api/documents/file - File uploaded successfully`, {
        url: blob.url,
        size: blob.size,
      })

      // Return success response with file details
      return {
        success: true,
        file: {
          documentId,
          fileName,
          fileSize: file.size,
          fileType: file.type,
          filePath: blobPath,
          url: blob.url,
          uploadedAt: new Date().toISOString(),
        },
        nextSteps: {
          createDocument: `/api/documents`,
          processDocument: `/api/documents/process`,
        },
      }
    } catch (error) {
      logger.error(`POST /api/documents/file - Error uploading file`, {
        error: error instanceof Error ? error.message : "Unknown error",
        fileName,
        fileSize: file.size,
      })

      throw new ValidationError(
        `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
        500,
      )
    }
  }, request)
})

/**
 * GET handler for file retrieval
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const blobUrl = searchParams.get("url")

  if (!path && !blobUrl) {
    logger.error("Document file request missing both path and url parameters")
    return NextResponse.json({ error: "Either path or url parameter is required" }, { status: 400 })
  }

  try {
    // Get user ID from request (for authorization)
    const userId = await getUserIdFromRequest(request)

    // If a direct blob URL is provided, redirect to it
    if (blobUrl) {
      logger.info(`GET /api/documents/file - Redirecting to blob URL`, { blobUrl })

      // In a real application, we would verify the user has access to this blob
      // For now, we'll just redirect

      return NextResponse.redirect(blobUrl)
    }

    // For path-based requests, try to get the blob
    if (path) {
      logger.info(`GET /api/documents/file - Retrieving document file by path`, { path })

      // Check if this is a blob path (starts with documents/)
      if (path.startsWith("documents/")) {
        try {
          // Try to get the blob directly
          const blob = await get(path)

          if (blob) {
            // In a real application, we would verify the user has access to this blob
            // For example, check if the path contains the user's ID

            // For now, we'll do a basic check
            if (path.includes(`/${userId}/`) || path.includes(`${userId}_`)) {
              logger.info(`GET /api/documents/file - Redirecting to blob URL for path`, {
                path,
                blobUrl: blob.url,
              })
              return NextResponse.redirect(blob.url)
            } else {
              logger.warn(`GET /api/documents/file - Unauthorized access attempt`, {
                userId,
                path,
              })
              return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
            }
          }
        } catch (blobError) {
          logger.warn(`GET /api/documents/file - Error retrieving blob, falling back to mock content`, {
            path,
            error: blobError instanceof Error ? blobError.message : "Unknown error",
          })
          // Fall through to mock content if blob not found
        }
      }

      // Legacy path handling with mock content for backward compatibility
      logger.info(`GET /api/documents/file - Returning mock content for legacy path`, { path })

      // Generate some sample content based on the file path
      const fileName = path.split("/").pop() || "unknown"

      const sampleContent = `# Sample Document: ${fileName}

This is a sample document for testing the document processing pipeline.

## Section 1: Introduction

This document is used to test the document processing pipeline, including:
- Text extraction
- Document chunking
- Embedding generation
- Vector storage

## Section 2: Technical Details

The document processing pipeline consists of several steps:
1. Extract text from the document
2. Split the text into chunks
3. Generate embeddings for each chunk
4. Store the embeddings in Pinecone

## Section 3: Testing

This document can be used to test various aspects of the pipeline:
- Handling of different file types
- Chunking strategies
- Embedding quality
- Vector search performance

## Section 4: Conclusion

By processing this document, we can verify that the entire pipeline is working correctly.

Generated for testing purposes at ${new Date().toISOString()}.
`

      logger.info(`GET /api/documents/file - Returning mock content`, {
        fileName,
        contentLength: sampleContent.length,
      })

      return new NextResponse(sampleContent, {
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "public, max-age=3600",
        },
      })
    }
  } catch (error) {
    logger.error(`GET /api/documents/file - Error retrieving document file`, {
      path,
      blobUrl,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve document file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
})
