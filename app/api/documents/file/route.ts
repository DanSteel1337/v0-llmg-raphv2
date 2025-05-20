/**
 * Document File API Route
 *
 * API endpoint for retrieving document files.
 * This is a mock implementation for testing purposes.
 *
 * Dependencies:
 * - @/utils/errorHandling for error handling
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { withErrorHandling } from "@/utils/errorHandling"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")

  if (!path) {
    logger.error("Document file request missing path parameter")
    return NextResponse.json({ error: "Path parameter is required" }, { status: 400 })
  }

  logger.info(`GET /api/documents/file - Retrieving document file`, { path })

  // This is a mock implementation that returns sample content based on the file path
  // In a real implementation, you would retrieve the file from storage

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

  logger.info(`GET /api/documents/file - Returning mock content`, { fileName, contentLength: sampleContent.length })

  return new NextResponse(sampleContent, {
    headers: {
      "Content-Type": "text/plain",
    },
  })
})
