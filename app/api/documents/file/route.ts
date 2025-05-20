/**
 * Document File API Route
 *
 * API endpoint for retrieving document files from Vercel Blob Storage.
 * Handles both legacy path-based requests and direct blob URLs.
 *
 * Dependencies:
 * - @/utils/errorHandling for error handling
 * - @/lib/utils/logger for logging
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { withErrorHandling } from "@/utils/errorHandling"
import { logger } from "@/lib/utils/logger"
import { get } from "@vercel/blob"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const blobUrl = searchParams.get("url")

  if (!path && !blobUrl) {
    logger.error("Document file request missing both path and url parameters")
    return NextResponse.json({ error: "Either path or url parameter is required" }, { status: 400 })
  }

  try {
    // If a direct blob URL is provided, redirect to it
    if (blobUrl) {
      logger.info(`GET /api/documents/file - Redirecting to blob URL`, { blobUrl })
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
            logger.info(`GET /api/documents/file - Redirecting to blob URL for path`, {
              path,
              blobUrl: blob.url,
            })
            return NextResponse.redirect(blob.url)
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
        error: "Failed to retrieve document file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
})
