/**
 * Document Processing API Route with Streaming Response
 *
 * Handles document processing requests with streaming progress updates.
 * Implements chunking, embedding generation, and vector storage in Pinecone.
 *
 * Features:
 * - Streaming response for real-time progress updates
 * - Validation of document type and content
 * - Semantic chunking that respects document structure
 * - Batched embedding generation with retry logic
 * - Rate limiting to avoid API limits
 * - Comprehensive error handling and logging
 *
 * Dependencies:
 * - @/lib/pinecone-rest-client for vector operations
 * - @/lib/embedding-service for embedding generation
 * - @/lib/chunking-utils for semantic document chunking
 * - @/lib/embedding-config for model configuration
 * - @/lib/utils/logger for structured logging
 * - @/utils/errorHandling for standardized error handling
 *
 * @module app/api/documents/process/route
 */

import { type NextRequest, NextResponse } from "next/server"
import { ValidationError, withErrorHandling } from "@/utils/errorHandling"
import { generateEmbedding } from "@/lib/embedding-service"
import { chunkDocument, splitByHeaders } from "@/lib/chunking-utils"
import { upsertVectors, createPlaceholderVector } from "@/lib/pinecone-rest-client"
import { EMBEDDING_MODEL, VECTOR_DIMENSION } from "@/lib/embedding-config"
import { logger } from "@/lib/utils/logger"
import { fetchDocumentById, updateDocumentStatus } from "@/services/document-service"

export const runtime = "edge"

// Constants for processing
const MAX_CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 150
const EMBEDDING_BATCH_SIZE = 10
const UPSERT_BATCH_SIZE = 100
const MAX_RETRIES = 3

/**
 * Validates document before processing
 *
 * @param documentId - Document ID to validate
 * @param fileType - File type to validate
 * @param fileUrl - File URL to validate content
 * @returns Validation result with document content if valid
 */
async function validateDocument(
  documentId: string,
  fileType: string,
  fileUrl: string,
): Promise<{
  valid: boolean
  content?: string
  error?: string
  document?: any
}> {
  try {
    // Validate document exists
    const document = await fetchDocumentById(documentId)
    if (!document) {
      return { valid: false, error: "Document not found" }
    }

    // Validate file type (.txt only)
    if (!fileType.includes("text/") && !fileType.includes(".txt")) {
      return { valid: false, error: "Only text files (.txt) are supported", document }
    }

    // Fetch document content
    const response = await fetch(fileUrl, { cache: "no-store" })
    if (!response.ok) {
      return {
        valid: false,
        error: `Failed to fetch document content: ${response.status} ${response.statusText}`,
        document,
      }
    }

    const content = await response.text()

    // Validate content is not empty
    if (!content || content.trim() === "") {
      return { valid: false, error: "Document is empty or contains no valid text content", document }
    }

    // Validate content size (max 10MB)
    if (content.length > 10 * 1024 * 1024) {
      return { valid: false, error: "Document is too large (max 10MB)", document }
    }

    return { valid: true, content, document }
  } catch (error) {
    logger.error("Error validating document", {
      documentId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return { valid: false, error: error instanceof Error ? error.message : "Failed to validate document" }
  }
}

/**
 * Checks if a chunk is informative enough to be embedded
 */
function isInformativeChunk(text: string): boolean {
  if (!text || text.trim() === "") {
    return false
  }

  // Consider markdown content as informative
  if (text.includes("#") || text.includes("|") || text.includes("```")) {
    return true
  }

  // Skip chunks that are too short
  if (text.trim().length < 10) {
    return false
  }

  // Skip chunks that don't have enough unique words
  const uniqueWords = new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 1),
  )

  if (uniqueWords.size < 3) {
    return false
  }

  return true
}

/**
 * Streams a progress update to the client
 *
 * @param controller - ReadableStreamDefaultController to write to
 * @param data - Data to stream
 */
function streamUpdate(controller: ReadableStreamDefaultController, data: any) {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"))
}

/**
 * POST handler for document processing with streaming response
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const { documentId, userId, filePath, fileName, fileType, fileUrl } = body

  // Validate required fields
  if (!documentId) {
    throw new ValidationError("Document ID is required")
  }

  if (!userId) {
    throw new ValidationError("User ID is required")
  }

  if (!filePath) {
    throw new ValidationError("File path is required")
  }

  if (!fileName) {
    throw new ValidationError("File name is required")
  }

  if (!fileUrl) {
    throw new ValidationError("File URL is required")
  }

  logger.info(`Processing document started`, {
    documentId,
    userId,
    fileName,
    fileType,
  })

  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initial progress update
        streamUpdate(controller, {
          type: "progress",
          status: "validating",
          progress: 0,
          message: "Validating document...",
        })

        // Update document status to processing
        await updateDocumentStatus(documentId, "processing", 0, "Starting document processing")

        // Validate document before processing
        const validation = await validateDocument(documentId, fileType, fileUrl)

        if (!validation.valid) {
          // Update document status to failed
          await updateDocumentStatus(documentId, "failed", 0, validation.error)

          // Stream error and close
          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: validation.error,
          })
          controller.close()
          return
        }

        const content = validation.content!
        const document = validation.document

        // Stream validation success
        streamUpdate(controller, {
          type: "progress",
          status: "validated",
          progress: 10,
          message: "Document validated successfully",
          contentLength: content.length,
        })

        // Update document status
        await updateDocumentStatus(documentId, "processing", 10, "Document validated, starting chunking")

        // Start timing for performance tracking
        const startTime = performance.now()
        const debugInfo: Record<string, any> = {
          processingStartTime: new Date().toISOString(),
          steps: {},
          timings: {},
        }

        // Semantic chunking
        streamUpdate(controller, {
          type: "progress",
          status: "chunking",
          progress: 20,
          message: "Chunking document content...",
        })

        // First try to split by headers for semantic chunking
        const sections = splitByHeaders(content)
        const chunks: string[] = []

        // Process each section
        for (const section of sections) {
          const sectionChunks = chunkDocument(
            section.header ? `# ${section.header}\n\n${section.content}` : section.content,
            MAX_CHUNK_SIZE,
            CHUNK_OVERLAP,
          )
          chunks.push(...sectionChunks)
        }

        // Filter out non-informative chunks
        const validChunks = chunks.filter((chunk) => isInformativeChunk(chunk))

        debugInfo.steps.chunking = {
          totalChunks: chunks.length,
          validChunks: validChunks.length,
          skippedChunks: chunks.length - validChunks.length,
        }

        // Check if we have any valid chunks
        if (validChunks.length === 0) {
          const errorMessage = "No valid content chunks could be extracted from document"
          await updateDocumentStatus(documentId, "failed", 0, errorMessage, {
            ...debugInfo,
            error: errorMessage,
            failedStep: "chunking",
          })

          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: errorMessage,
          })
          controller.close()
          return
        }

        streamUpdate(controller, {
          type: "progress",
          status: "chunked",
          progress: 30,
          message: `Document chunked into ${validChunks.length} valid chunks`,
          totalChunks: chunks.length,
          validChunks: validChunks.length,
        })

        await updateDocumentStatus(
          documentId,
          "processing",
          30,
          `Chunking complete. Generating embeddings for ${validChunks.length} chunks using ${EMBEDDING_MODEL}`,
        )

        // Generate embeddings and store in Pinecone
        let successfulEmbeddings = 0
        let failedEmbeddings = 0
        let totalVectorsInserted = 0

        debugInfo.steps.embedding = {
          batches: [],
          totalBatches: Math.ceil(validChunks.length / EMBEDDING_BATCH_SIZE),
          successfulEmbeddings: 0,
          failedEmbeddings: 0,
          embeddingModel: EMBEDDING_MODEL,
        }

        // Process chunks in batches for embedding generation
        for (let i = 0; i < validChunks.length; i += EMBEDDING_BATCH_SIZE) {
          const batchStartTime = performance.now()
          const batch = validChunks.slice(i, i + EMBEDDING_BATCH_SIZE)
          const batchProgress = Math.floor(30 + (i / validChunks.length) * 60)
          const batchNumber = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1
          const totalBatches = Math.ceil(validChunks.length / EMBEDDING_BATCH_SIZE)

          // Update document status
          await updateDocumentStatus(
            documentId,
            "processing",
            batchProgress,
            `Processing batch ${batchNumber}/${totalBatches}`,
          )

          // Stream batch progress
          streamUpdate(controller, {
            type: "progress",
            status: "embedding",
            progress: batchProgress,
            message: `Processing batch ${batchNumber}/${totalBatches}`,
            batchNumber,
            totalBatches,
          })

          const batchInfo = {
            batchNumber,
            startIndex: i,
            endIndex: i + batch.length - 1,
            chunkCount: batch.length,
            success: false,
            embeddingResults: [],
            errors: [],
            startTime: new Date().toISOString(),
            duration: 0,
          }

          // Generate embeddings for this batch with retry logic
          const embeddingPromises = batch.map(async (chunk, index) => {
            // Skip empty chunks
            if (!chunk || chunk.trim() === "") {
              return null
            }

            // Try to generate embedding with retries
            for (let retry = 0; retry < MAX_RETRIES; retry++) {
              try {
                const embedding = await generateEmbedding(chunk)

                // Validate embedding
                if (embedding.length !== VECTOR_DIMENSION) {
                  throw new Error(`Invalid embedding dimension: ${embedding.length}, expected ${VECTOR_DIMENSION}`)
                }

                // Create chunk ID with proper prefix
                const chunkId = `chunk_${documentId}_${i + index}`

                // Create timestamp for metadata
                const timestamp = new Date().toISOString()

                return {
                  id: chunkId,
                  values: embedding,
                  metadata: {
                    content: chunk,
                    document_id: documentId,
                    document_name: fileName,
                    document_type: fileType,
                    user_id: userId,
                    index: i + index,
                    record_type: "chunk",
                    created_at: timestamp,
                    updated_at: timestamp,
                    embedding_model: EMBEDDING_MODEL,
                  },
                }
              } catch (error) {
                // If this is the last retry, log and return null
                if (retry === MAX_RETRIES - 1) {
                  logger.error(`Failed to generate embedding after ${MAX_RETRIES} retries`, {
                    documentId,
                    chunkIndex: i + index,
                    error: error instanceof Error ? error.message : "Unknown error",
                  })
                  return null
                }

                // Otherwise, wait and retry
                const backoffTime = Math.pow(2, retry) * 1000
                await new Promise((resolve) => setTimeout(resolve, backoffTime))
              }
            }

            // If we get here, all retries failed
            return null
          })

          try {
            const embeddingResults = await Promise.all(embeddingPromises)

            // Filter out null results (failed embeddings)
            const embeddings = embeddingResults.filter((result) => result !== null) as any[]

            successfulEmbeddings += embeddings.length
            failedEmbeddings += batch.length - embeddings.length

            batchInfo.success = embeddings.length > 0
            batchInfo.successfulEmbeddings = embeddings.length
            batchInfo.failedEmbeddings = batch.length - embeddings.length

            if (embeddings.length > 0) {
              // Store embeddings in Pinecone in batches
              for (let j = 0; j < embeddings.length; j += UPSERT_BATCH_SIZE) {
                const upsertBatch = embeddings.slice(j, j + UPSERT_BATCH_SIZE)

                // Try to upsert with retries
                for (let retry = 0; retry < MAX_RETRIES; retry++) {
                  try {
                    const upsertResult = await upsertVectors(upsertBatch)
                    totalVectorsInserted += upsertResult.upsertedCount || upsertBatch.length
                    break
                  } catch (error) {
                    // If this is the last retry, log the error
                    if (retry === MAX_RETRIES - 1) {
                      logger.error(`Failed to upsert vectors after ${MAX_RETRIES} retries`, {
                        documentId,
                        batchNumber,
                        error: error instanceof Error ? error.message : "Unknown error",
                      })
                      throw error
                    }

                    // Otherwise, wait and retry
                    const backoffTime = Math.pow(2, retry) * 1000
                    await new Promise((resolve) => setTimeout(resolve, backoffTime))
                  }
                }
              }

              // Stream batch completion
              streamUpdate(controller, {
                type: "progress",
                status: "batch_complete",
                progress: batchProgress,
                message: `Batch ${batchNumber}/${totalBatches} complete`,
                batchNumber,
                totalBatches,
                successfulEmbeddings: embeddings.length,
                totalSuccessful: successfulEmbeddings,
                totalVectorsInserted,
              })
            }
          } catch (error) {
            logger.error(`Error processing batch ${batchNumber}`, {
              documentId,
              batchNumber,
              error: error instanceof Error ? error.message : "Unknown error",
            })

            // Stream batch error but continue processing
            streamUpdate(controller, {
              type: "warning",
              status: "batch_error",
              progress: batchProgress,
              message: `Error in batch ${batchNumber}: ${error instanceof Error ? error.message : "Unknown error"}`,
              batchNumber,
              totalBatches,
              continueProcessing: true,
            })
          }

          batchInfo.duration = performance.now() - batchStartTime
          debugInfo.steps.embedding.batches.push(batchInfo)
        }

        debugInfo.steps.embedding.successfulEmbeddings = successfulEmbeddings
        debugInfo.steps.embedding.failedEmbeddings = failedEmbeddings
        debugInfo.steps.embedding.totalVectorsInserted = totalVectorsInserted

        // Check if we have any successful embeddings
        if (successfulEmbeddings === 0) {
          const errorMessage = "Failed to generate any valid embeddings"
          await updateDocumentStatus(documentId, "failed", 0, errorMessage, {
            ...debugInfo,
            error: errorMessage,
            failedStep: "embedding",
          })

          streamUpdate(controller, {
            type: "error",
            status: "failed",
            message: errorMessage,
          })
          controller.close()
          return
        }

        // Update document metadata with final status
        debugInfo.processingEndTime = new Date().toISOString()
        debugInfo.totalDuration = performance.now() - startTime

        // Create a placeholder vector for document metadata
        const placeholderVector = createPlaceholderVector()

        // Update document status to indexed
        await upsertVectors([
          {
            id: documentId,
            values: placeholderVector,
            metadata: {
              id: documentId,
              user_id: userId,
              name: fileName,
              file_type: fileType,
              file_size: content.length,
              file_path: filePath,
              status: "indexed",
              processing_progress: 100,
              chunk_count: successfulEmbeddings,
              embedding_model: EMBEDDING_MODEL,
              created_at: document?.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              record_type: "document",
              debug_info: debugInfo,
            },
          },
        ])

        // Stream completion
        streamUpdate(controller, {
          type: "complete",
          status: "indexed",
          progress: 100,
          message: "Document processing complete",
          totalChunks: validChunks.length,
          successfulEmbeddings,
          failedEmbeddings,
          totalVectorsInserted,
          processingTime: debugInfo.totalDuration,
        })

        // Close the stream
        controller.close()
      } catch (error) {
        logger.error("Error in document processing stream", {
          documentId,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        })

        // Try to update document status to failed
        try {
          await updateDocumentStatus(
            documentId,
            "failed",
            0,
            error instanceof Error ? error.message : "Unknown error in document processing",
          )
        } catch (statusError) {
          logger.error("Failed to update document status after error", {
            documentId,
            error: statusError instanceof Error ? statusError.message : "Unknown error",
          })
        }

        // Stream error and close
        streamUpdate(controller, {
          type: "error",
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown error in document processing",
        })
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
})
