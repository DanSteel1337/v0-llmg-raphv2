/**
 * Document Processing Service
 *
 * Core service for document management, processing, and vector operations.
 * Handles the complete document lifecycle including:
 * - Document metadata creation and management
 * - Text extraction and processing
 * - Chunking of document content
 * - Embedding generation
 * - Vector storage and retrieval
 * - Document status tracking
 *
 * IMPORTANT:
 * - Always use the standardized document ID format: `doc_${timestamp}_${random}`
 * - Don't add prefixes like 'meta_' to document IDs when storing in Pinecone
 * - Always use createPlaceholderVector() for vector placeholders, never zero vectors
 * - Document status should be one of: "processing", "indexed", "failed"
 * - All document operations must be Edge-compatible (no Node.js modules)
 *
 * Dependencies:
 * - @/lib/pinecone-rest-client for vector database operations
 * - @/lib/embedding-service for embedding generation
 * - @/lib/chunking-utils for document text processing
 * - @/lib/utils/logger for structured logging
 * - @/lib/blob-client for blob storage operations
 * - @/types for document types
 *
 * @module lib/document-service
 */

import { upsertVectors, queryVectors, deleteVectors, createPlaceholderVector } from "@/lib/pinecone-rest-client"
import { generateEmbedding } from "@/lib/embedding-service"
import { chunkDocument } from "@/lib/chunking-utils"
import { EMBEDDING_MODEL } from "@/lib/embedding-config"
import { logger } from "@/lib/utils/logger"
import { deleteFromBlob } from "@/lib/blob-client"
import type { Document, ProcessDocumentOptions } from "@/types"

// Constants
const MAX_CHUNK_SIZE = 1000 // Optimal size for embedding chunks
const CHUNK_OVERLAP = 150 // Overlap between consecutive chunks
const EMBEDDING_BATCH_SIZE = 10 // Process embeddings in small batches
const MAX_RETRIES = 3 // Maximum retries for API operations
const UPSERT_BATCH_SIZE = 100 // Batch size for upserting vectors to Pinecone

/**
 * Creates a new document and stores its metadata
 *
 * @param userId - User ID for document ownership
 * @param name - Document name
 * @param description - Optional document description
 * @param fileType - Document MIME type
 * @param fileSize - Document size in bytes
 * @param filePath - Storage path for the document
 * @returns Created document metadata
 */
export async function createDocument(
  userId: string,
  name: string,
  description?: string,
  fileType?: string,
  fileSize?: number,
  filePath?: string,
): Promise<Document> {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  const documentId = `doc_${timestamp}_${random}`
  const now = new Date().toISOString()

  const document: Document = {
    id: documentId,
    user_id: userId,
    name,
    description: description || "",
    file_type: fileType || "text/plain",
    file_size: fileSize || 0,
    file_path: filePath || "",
    status: "processing", // Set initial status to "processing"
    processing_progress: 0,
    error_message: undefined,
    created_at: now,
    updated_at: now,
  }

  logger.info(`Creating document record`, { userId, name, documentId })

  // Create a placeholder vector with small non-zero values
  const placeholderVector = createPlaceholderVector()

  await upsertVectors([
    {
      id: documentId, // Use consistent ID pattern with no prefix
      values: placeholderVector, // Non-zero placeholder vector
      metadata: {
        ...document,
        record_type: "document", // Consistent record_type field
      },
    },
  ])

  logger.info(`Document record created successfully`, { documentId, userId })

  return document
}

/**
 * Gets documents by user ID
 *
 * @param userId - User ID to filter documents
 * @returns Array of documents
 */
export async function fetchDocuments(userId: string): Promise<Document[]> {
  logger.info(`Getting documents for user`, { userId })

  // Create a placeholder vector with non-zero values
  const placeholderVector = createPlaceholderVector()

  const response = await queryVectors(
    placeholderVector, // Using correct non-zero vector
    100,
    true,
    {
      user_id: { $eq: userId },
      record_type: { $eq: "document" },
    },
  )

  // Handle potential error from Pinecone
  if ("error" in response && response.error) {
    logger.error("Error querying documents from Pinecone:", response)
    return [] // Return empty array as fallback
  }

  // Ensure matches is an array before mapping
  const matches = Array.isArray(response.matches) ? response.matches : []

  const documents = matches.map((match) => ({
    id: match.id,
    user_id: match.metadata?.user_id as string,
    name: match.metadata?.name as string,
    description: match.metadata?.description as string,
    file_type: match.metadata?.file_type as string,
    file_size: match.metadata?.file_size as number,
    file_path: match.metadata?.file_path as string,
    status: match.metadata?.status as "processing" | "indexed" | "failed",
    processing_progress: match.metadata?.processing_progress as number,
    error_message: match.metadata?.error_message as string | undefined,
    created_at: match.metadata?.created_at as string,
    updated_at: match.metadata?.updated_at as string,
    debug_info: match.metadata?.debug_info as Record<string, any> | undefined,
  }))

  logger.info(`Found ${documents.length} documents for user`, { userId })
  return documents
}

/**
 * Gets a document by ID
 *
 * @param id - Document ID
 * @returns Document object or null if not found
 */
export async function fetchDocumentById(id: string): Promise<Document | null> {
  // Create a placeholder vector with small non-zero values
  const placeholderVector = createPlaceholderVector()

  const response = await queryVectors(
    placeholderVector, // Non-zero placeholder vector
    1,
    true,
    {
      id: { $eq: id },
      record_type: { $eq: "document" },
    },
  )

  // Handle potential error from Pinecone
  if ("error" in response && response.error) {
    logger.error("Error querying document from Pinecone:", response)
    return null // Return null as fallback
  }

  if (!response.matches || response.matches.length === 0) {
    return null
  }

  const match = response.matches[0]

  return {
    id: match.id,
    user_id: match.metadata?.user_id as string,
    name: match.metadata?.name as string,
    description: match.metadata?.description as string,
    file_type: match.metadata?.file_type as string,
    file_size: match.metadata?.file_size as number,
    file_path: match.metadata?.file_path as string,
    status: match.metadata?.status as "processing" | "indexed" | "failed",
    processing_progress: match.metadata?.processing_progress as number,
    error_message: match.metadata?.error_message as string | undefined,
    created_at: match.metadata?.created_at as string,
    updated_at: match.metadata?.updated_at as string,
    debug_info: match.metadata?.debug_info as Record<string, any> | undefined,
  }
}

/**
 * Updates a document's status
 *
 * @param documentId - Document ID
 * @param status - New status
 * @param progress - Processing progress percentage
 * @param errorMessage - Optional error message
 * @param debugInfo - Optional debug information
 * @returns Updated document
 */
export async function updateDocumentStatus(
  documentId: string,
  status: "processing" | "indexed" | "failed",
  progress: number,
  errorMessage?: string,
  debugInfo?: Record<string, any>,
): Promise<Document> {
  // Get current document
  const document = await fetchDocumentById(documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  const updatedDocument = {
    ...document,
    status,
    processing_progress: progress,
    error_message: errorMessage,
    debug_info: debugInfo || document.debug_info,
    updated_at: new Date().toISOString(),
  }

  logger.info(`Updating document status`, {
    documentId,
    status,
    progress,
    errorMessage: errorMessage ? `${errorMessage.substring(0, 100)}...` : undefined,
    hasDebugInfo: !!debugInfo,
  })

  // Create a non-zero placeholder vector
  const placeholderVector = createPlaceholderVector()

  await upsertVectors([
    {
      id: documentId, // Use consistent ID pattern with no prefix
      values: placeholderVector,
      metadata: {
        ...updatedDocument,
        record_type: "document",
      },
    },
  ])

  return updatedDocument
}

/**
 * Processes a document by extracting text, creating chunks, and generating embeddings
 *
 * @param options - Document processing options
 * @returns Processing result
 */
export async function processDocumentAndEmbed({
  documentId,
  userId,
  filePath,
  fileName,
  fileType,
  fileUrl,
  isRetry = false,
}: ProcessDocumentOptions & { isRetry?: boolean }): Promise<{
  success: boolean
  chunksProcessed: number
  vectorsInserted: number
  error?: string
  debugInfo?: Record<string, any>
}> {
  // Initialize timing and debug info
  const startTime = performance.now()
  const debugInfo: Record<string, any> = {
    processingStartTime: new Date().toISOString(),
    isRetry,
    steps: {},
    timings: {},
  }

  // Set initial progress to ensure UI shows activity
  await updateDocumentStatus(documentId, "processing", 5, "Starting document processing", {
    ...debugInfo,
    currentStep: "initialization",
    processingStarted: true,
  })

  try {
    // Validate required parameters
    if (!documentId) throw new Error("documentId is required")
    if (!userId) throw new Error("userId is required")
    if (!filePath) throw new Error("filePath is required")
    if (!fileName) throw new Error("fileName is required")
    if (!fileType) throw new Error("fileType is required")
    if (!fileUrl) throw new Error("fileUrl is required")

    // Check if document is already being processed (prevent duplicate processing)
    if (!isRetry) {
      const existingDoc = await fetchDocumentById(documentId)
      if (existingDoc && existingDoc.status === "processing" && existingDoc.processing_progress > 0) {
        logger.warn(
          `Document ${documentId} is already being processed (progress: ${existingDoc.processing_progress}%). Skipping.`,
        )
        return {
          success: false,
          chunksProcessed: 0,
          vectorsInserted: 0,
          error: "Document is already being processed",
          debugInfo: {
            ...debugInfo,
            existingStatus: existingDoc.status,
            existingProgress: existingDoc.processing_progress,
            skippedReason: "Already processing",
          },
        }
      }
    }

    // Update document status to processing
    const fetchStartTime = performance.now()
    await updateDocumentStatus(documentId, "processing", 10, "Fetching document content", {
      ...debugInfo,
      currentStep: "fetch_content",
      processingStarted: true,
    })
    debugInfo.timings.statusUpdateTime = performance.now() - fetchStartTime

    // 1. Extract text from document
    logger.info(`Processing document: Fetching content`, {
      documentId,
      fileUrl,
      isRetry,
      fileName,
      fileType,
    })

    let response
    let retries = 0
    let fetchSuccess = false
    let fetchError = null

    // Implement retry logic for fetching the document
    const fetchContentStartTime = performance.now()
    while (retries < MAX_RETRIES && !fetchSuccess) {
      try {
        response = await fetch(fileUrl, { cache: "no-store" })
        if (response.ok) {
          fetchSuccess = true
          break
        }

        logger.warn(`Fetch attempt ${retries + 1} failed with status ${response.status}`, {
          documentId,
          fileUrl,
          attempt: retries + 1,
          maxRetries: MAX_RETRIES,
          status: response.status,
          statusText: response.statusText,
        })

        fetchError = `HTTP error: ${response.status} ${response.statusText}`

        // Exponential backoff
        const backoffTime = Math.pow(2, retries) * 1000
        logger.info(`Backing off for ${backoffTime}ms before retry`, { documentId, retries })
        await new Promise((resolve) => setTimeout(resolve, backoffTime))
        retries++
      } catch (fetchError) {
        logger.error(`Fetch attempt ${retries + 1} failed with error`, {
          documentId,
          error: fetchError instanceof Error ? fetchError.message : "Unknown error",
          attempt: retries + 1,
          maxRetries: MAX_RETRIES,
        })

        if (retries >= MAX_RETRIES - 1) {
          fetchError = fetchError instanceof Error ? fetchError.message : "Unknown fetch error"
          break
        }

        // Exponential backoff
        const backoffTime = Math.pow(2, retries) * 1000
        logger.info(`Backing off for ${backoffTime}ms before retry`, { documentId, retries })
        await new Promise((resolve) => setTimeout(resolve, backoffTime))
        retries++
      }
    }

    debugInfo.timings.fetchContentTime = performance.now() - fetchContentStartTime
    debugInfo.steps.fetchContent = {
      success: fetchSuccess,
      retries,
      error: fetchSuccess ? null : fetchError,
      statusCode: response?.status,
      contentType: response?.headers.get("content-type"),
    }

    if (!fetchSuccess) {
      const errorMessage = `Failed to fetch document: ${fetchError || "Unknown error"}`
      logger.error(errorMessage, { documentId, fileUrl, retries })

      // Update status with more detailed error information
      await updateDocumentStatus(documentId, "failed", 0, errorMessage, {
        ...debugInfo,
        error: errorMessage,
        failedStep: "fetch_content",
        processingEndTime: new Date().toISOString(),
        totalDuration: performance.now() - startTime,
        networkDetails: {
          attempts: retries + 1,
          lastStatus: response?.status,
          lastStatusText: response?.statusText,
        },
      })

      return {
        success: false,
        chunksProcessed: 0,
        vectorsInserted: 0,
        error: errorMessage,
        debugInfo,
      }
    }

    // Successfully fetched the document, now extract text
    const text = await response.text()
    debugInfo.steps.fetchContent.contentLength = text.length
    debugInfo.steps.fetchContent.contentPreview = text.substring(0, 200) + "..."

    // Validate content is not empty
    if (!text || text.trim() === "") {
      const errorMessage = "Document is empty or contains no valid text content"
      logger.error(errorMessage, { documentId, fileUrl })

      await updateDocumentStatus(documentId, "failed", 0, errorMessage, {
        ...debugInfo,
        error: errorMessage,
        failedStep: "content_validation",
        processingEndTime: new Date().toISOString(),
        totalDuration: performance.now() - startTime,
      })

      return {
        success: false,
        chunksProcessed: 0,
        vectorsInserted: 0,
        error: errorMessage,
        debugInfo,
      }
    }

    logger.info(`Processing document: Content fetched successfully`, {
      documentId,
      contentLength: text.length,
      contentPreview: text.substring(0, 100) + "...",
    })

    await updateDocumentStatus(documentId, "processing", 30, "Chunking document content", {
      ...debugInfo,
      currentStep: "chunking",
      contentLength: text.length,
    })

    // 2. Split text into chunks
    logger.info(`Processing document: Chunking content`, {
      documentId,
      contentLength: text.length,
      maxChunkSize: MAX_CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    })

    const chunkingStartTime = performance.now()
    const allChunks = chunkDocument(text, MAX_CHUNK_SIZE, CHUNK_OVERLAP)
    debugInfo.timings.chunkingTime = performance.now() - chunkingStartTime

    // DEBUGGING: Log chunks before filtering
    logger.info(`Document chunks before filtering:`, {
      documentId,
      totalChunks: allChunks.length,
      sampleChunk: allChunks.length > 0 ? allChunks[0].substring(0, 100) + "..." : "None",
      chunkSizes: allChunks.slice(0, 5).map((chunk) => chunk.length),
    })

    // Filter out non-informative chunks
    const filteringStartTime = performance.now()
    const chunks = allChunks.filter((chunk) => isInformativeChunk(chunk))
    debugInfo.timings.filteringTime = performance.now() - filteringStartTime

    debugInfo.steps.chunking = {
      success: true,
      totalChunks: allChunks.length,
      validChunks: chunks.length,
      skippedChunks: allChunks.length - chunks.length,
      averageChunkSize: chunks.length > 0 ? chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length : 0,
      chunkSizesHistogram: calculateChunkSizeHistogram(chunks),
    }

    // DEBUGGING: Log chunks after filtering
    logger.info(`Document chunks after filtering:`, {
      documentId,
      validChunks: chunks.length,
      sampleChunk: chunks.length > 0 ? chunks[0].substring(0, 100) + "..." : "None",
      skippedChunks: allChunks.length - chunks.length,
      filteringTime: debugInfo.timings.filteringTime.toFixed(2) + "ms",
    })

    logger.info(`Processing document: Chunking complete`, {
      documentId,
      totalChunks: allChunks.length,
      validChunks: chunks.length,
      skippedChunks: allChunks.length - chunks.length,
    })

    // Check if we have any valid chunks
    if (chunks.length === 0) {
      const errorMessage = "Document processing failed: No valid content chunks could be extracted"
      logger.error(errorMessage, { documentId, fileName })

      await updateDocumentStatus(documentId, "failed", 0, errorMessage, {
        ...debugInfo,
        error: errorMessage,
        failedStep: "chunking",
        processingEndTime: new Date().toISOString(),
        totalDuration: performance.now() - startTime,
      })

      return {
        success: false,
        chunksProcessed: 0,
        vectorsInserted: 0,
        error: errorMessage,
        debugInfo,
      }
    }

    await updateDocumentStatus(
      documentId,
      "processing",
      40,
      `Generating embeddings for ${chunks.length} chunks using ${EMBEDDING_MODEL}`,
      {
        ...debugInfo,
        currentStep: "embedding",
        chunkCount: chunks.length,
        embeddingModel: EMBEDDING_MODEL,
      },
    )

    // 3. Generate embeddings and store in Pinecone
    let successfulEmbeddings = 0
    let failedEmbeddings = 0
    let totalVectorsInserted = 0

    debugInfo.steps.embedding = {
      batches: [],
      totalBatches: Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE),
      successfulEmbeddings: 0,
      failedEmbeddings: 0,
      embeddingModel: EMBEDDING_MODEL,
    }

    // Process chunks in batches for embedding generation
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batchStartTime = performance.now()
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)
      // More granular progress updates with minimum progress of 10%
      const batchProgress = Math.max(10, Math.floor(40 + (i / chunks.length) * 50))
      const batchNumber = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1
      const totalBatches = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)

      await updateDocumentStatus(
        documentId,
        "processing",
        batchProgress,
        `Processing batch ${batchNumber}/${totalBatches}`,
        {
          ...debugInfo,
          currentStep: "embedding",
          currentBatch: batchNumber,
          totalBatches,
          progress: batchProgress,
        },
      )

      logger.info(`Processing document: Generating embeddings for batch`, {
        documentId,
        batchNumber,
        totalBatches,
        batchSize: batch.length,
        progress: `${batchProgress}%`,
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

      // Generate embeddings for this batch
      const embeddingStartTime = performance.now()
      const embeddingPromises = batch.map(async (chunk, index) => {
        try {
          // Skip empty or whitespace-only chunks
          if (!chunk || chunk.trim() === "") {
            logger.info("Skipping empty chunk", { documentId, chunkIndex: i + index })
            failedEmbeddings++
            batchInfo.errors.push({
              chunkIndex: i + index,
              error: "Empty chunk",
            })
            return null
          }

          const chunkEmbeddingStartTime = performance.now()
          const embedding = await generateEmbedding(chunk)
          const chunkEmbeddingTime = performance.now() - chunkEmbeddingStartTime

          // Validate embedding is not all zeros
          if (embedding.every((v) => v === 0)) {
            logger.error("Skipping zero-vector embedding", {
              documentId,
              chunkIndex: i + index,
              chunkSample: chunk.substring(0, 50) + "...",
            })
            failedEmbeddings++
            batchInfo.errors.push({
              chunkIndex: i + index,
              error: "Zero-vector embedding",
              chunkSample: chunk.substring(0, 50) + "...",
            })
            return null
          }

          successfulEmbeddings++
          batchInfo.embeddingResults.push({
            chunkIndex: i + index,
            embeddingDimension: embedding.length,
            embeddingTime: chunkEmbeddingTime,
          })

          return {
            id: `chunk_${documentId}_${i + index}`,
            values: embedding,
            metadata: {
              content: chunk,
              document_id: documentId,
              document_name: fileName,
              document_type: fileType,
              user_id: userId,
              index: i + index,
              record_type: "chunk",
              created_at: new Date().toISOString(),
              embedding_time_ms: chunkEmbeddingTime,
            },
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          logger.error(`Error generating embedding for chunk:`, {
            documentId,
            chunkIndex: i + index,
            error: errorMessage,
            chunkSample: chunk.substring(0, 100) + "...",
          })

          // Check for specific error types
          let errorType = "unknown"
          if (errorMessage.includes("rate limit")) {
            errorType = "rate_limit"
          } else if (errorMessage.includes("dimension mismatch")) {
            errorType = "dimension_mismatch"
          } else if (errorMessage.includes("timeout")) {
            errorType = "timeout"
          }

          failedEmbeddings++
          batchInfo.errors.push({
            chunkIndex: i + index,
            error: errorMessage,
            errorType,
            chunkSample: chunk.substring(0, 100) + "...",
          })

          return null
        }
      })

      debugInfo.timings.embeddingTime =
        (debugInfo.timings.embeddingTime || 0) + (performance.now() - embeddingStartTime)

      try {
        const embeddingResults = await Promise.all(embeddingPromises)

        // Filter out null results (failed embeddings)
        const embeddings = embeddingResults.filter((result) => result !== null) as any[]

        batchInfo.success = embeddings.length > 0
        batchInfo.successfulEmbeddings = embeddings.length
        batchInfo.failedEmbeddings = batch.length - embeddings.length

        if (embeddings.length > 0) {
          // Store embeddings in Pinecone in batches of UPSERT_BATCH_SIZE
          for (let j = 0; j < embeddings.length; j += UPSERT_BATCH_SIZE) {
            const upsertBatch = embeddings.slice(j, j + UPSERT_BATCH_SIZE)
            const upsertBatchNumber = Math.floor(j / UPSERT_BATCH_SIZE) + 1
            const upsertStartTime = performance.now()

            logger.info(`Processing document: Upserting vectors to Pinecone`, {
              documentId,
              batchNumber,
              upsertBatchNumber,
              vectorCount: upsertBatch.length,
            })

            try {
              const upsertResult = await upsertVectors(upsertBatch)
              const upsertTime = performance.now() - upsertStartTime
              totalVectorsInserted += upsertResult.upsertedCount || upsertBatch.length

              batchInfo.upsertResults = batchInfo.upsertResults || []
              batchInfo.upsertResults.push({
                upsertBatchNumber,
                vectorCount: upsertBatch.length,
                upsertedCount: upsertResult.upsertedCount || upsertBatch.length,
                upsertTime,
              })

              logger.info(`Processing document: Vectors upserted successfully`, {
                documentId,
                batchNumber,
                upsertBatchNumber,
                vectorsInserted: upsertResult.upsertedCount || upsertBatch.length,
                upsertTime: `${upsertTime.toFixed(2)}ms`,
              })
            } catch (upsertError) {
              const errorMessage = upsertError instanceof Error ? upsertError.message : "Unknown error"
              logger.error(`Error upserting vectors to Pinecone`, {
                documentId,
                batchNumber,
                upsertBatchNumber,
                error: errorMessage,
              })

              // Check for specific error types
              let errorType = "unknown"
              if (errorMessage.includes("rate limit")) {
                errorType = "rate_limit"
              } else if (errorMessage.includes("dimension mismatch")) {
                errorType = "dimension_mismatch"
              } else if (errorMessage.includes("timeout")) {
                errorType = "timeout"
              }

              batchInfo.upsertErrors = batchInfo.upsertErrors || []
              batchInfo.upsertErrors.push({
                upsertBatchNumber,
                vectorCount: upsertBatch.length,
                error: errorMessage,
                errorType,
              })

              failedEmbeddings += upsertBatch.length
            }
          }
        } else {
          logger.warn(`Processing document: No valid embeddings in batch`, {
            documentId,
            batchNumber,
          })
        }
      } catch (batchError) {
        const errorMessage = batchError instanceof Error ? batchError.message : "Unknown error"
        logger.error(`Error processing embedding batch`, {
          documentId,
          batchNumber,
          error: errorMessage,
        })

        batchInfo.success = false
        batchInfo.batchError = errorMessage

        // Continue with the next batch even if this one failed
      }

      batchInfo.duration = performance.now() - batchStartTime
      batchInfo.endTime = new Date().toISOString()
      debugInfo.steps.embedding.batches.push(batchInfo)
    }

    debugInfo.steps.embedding.successfulEmbeddings = successfulEmbeddings
    debugInfo.steps.embedding.failedEmbeddings = failedEmbeddings
    debugInfo.steps.embedding.totalVectorsInserted = totalVectorsInserted

    // 4. Update document status based on embedding results
    if (successfulEmbeddings === 0) {
      const errorMessage = `Document processing failed: Could not generate any valid embeddings from ${chunks.length} chunks`
      logger.error(errorMessage, { documentId })

      await updateDocumentStatus(documentId, "failed", 0, errorMessage, {
        ...debugInfo,
        error: errorMessage,
        failedStep: "embedding",
        processingEndTime: new Date().toISOString(),
        totalDuration: performance.now() - startTime,
      })

      return {
        success: false,
        chunksProcessed: chunks.length,
        vectorsInserted: 0,
        error: errorMessage,
        debugInfo,
      }
    }

    // Also update document with chunk count metadata
    const finalUpdateStartTime = performance.now()
    const placeholderVector = createPlaceholderVector()

    debugInfo.processingEndTime = new Date().toISOString()
    debugInfo.totalDuration = performance.now() - startTime
    debugInfo.finalStatus = "indexed"

    await upsertVectors([
      {
        id: documentId, // Use consistent ID pattern with no prefix
        values: placeholderVector,
        metadata: {
          id: documentId,
          user_id: userId,
          name: fileName,
          file_type: fileType,
          file_size: text.length,
          file_path: filePath,
          status: "indexed",
          processing_progress: 100,
          chunk_count: successfulEmbeddings,
          embedding_model: EMBEDDING_MODEL,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          record_type: "document",
          debug_info: debugInfo,
        },
      },
    ])

    debugInfo.timings.finalUpdateTime = performance.now() - finalUpdateStartTime

    logger.info(`Processing document: Complete`, {
      documentId,
      totalChunks: chunks.length,
      successfulEmbeddings,
      failedEmbeddings,
      totalVectorsInserted,
      totalDuration: debugInfo.totalDuration.toFixed(2) + "ms",
    })

    return {
      success: true,
      chunksProcessed: chunks.length,
      vectorsInserted: totalVectorsInserted,
      debugInfo,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    logger.error("Error processing document:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      documentId,
    })

    // Detect specific error types
    let errorType = "unknown"
    if (errorMessage.includes("rate limit")) {
      errorType = "rate_limit"
    } else if (errorMessage.includes("dimension mismatch")) {
      errorType = "dimension_mismatch"
    } else if (errorMessage.includes("timeout")) {
      errorType = "timeout"
    } else if (errorMessage.includes("fetch")) {
      errorType = "fetch_error"
    }

    debugInfo.processingEndTime = new Date().toISOString()
    debugInfo.totalDuration = performance.now() - startTime
    debugInfo.error = errorMessage
    debugInfo.errorType = errorType
    debugInfo.errorStack = error instanceof Error ? error.stack : undefined
    debugInfo.finalStatus = "failed"

    // Update document status to failed
    try {
      await updateDocumentStatus(documentId, "failed", 0, errorMessage, debugInfo)
    } catch (statusError) {
      logger.error("Failed to update document status after error:", statusError)
    }

    return {
      success: false,
      chunksProcessed: 0,
      vectorsInserted: 0,
      error: errorMessage,
      debugInfo,
    }
  }
}

/**
 * Deletes a document and all its chunks
 *
 * @param id - Document ID
 */
export async function deleteDocument(id: string): Promise<boolean> {
  // Delete the document
  await deleteVectors([id]) // Use consistent ID pattern with no prefix

  // Create a placeholder vector with small non-zero values
  const placeholderVector = createPlaceholderVector()

  // Find all chunks for this document
  const response = await queryVectors(placeholderVector, 1000, true, {
    document_id: { $eq: id },
    record_type: { $eq: "chunk" },
  })

  // Delete all chunks
  if (response.matches && response.matches.length > 0) {
    const chunkIds = response.matches.map((match) => match.id)
    await deleteVectors(chunkIds)
  }

  // Get the document to find its blob path
  const document = await fetchDocumentById(id)

  if (!document) {
    logger.warn(`Document not found for deletion`, { id })
    return false
  }

  // Delete the file from blob storage if file_path looks like a blob path
  if (document.file_path && document.file_path.startsWith("documents/")) {
    logger.info(`Deleting document file from blob storage`, {
      id,
      filePath: document.file_path,
    })

    try {
      await deleteFromBlob(document.file_path)
      logger.info(`Document file deleted from blob storage`, { id })
    } catch (blobError) {
      logger.error(`Error deleting document file from blob storage`, {
        id,
        filePath: document.file_path,
        error: blobError instanceof Error ? blobError.message : "Unknown error",
      })
      // Continue with the document deletion even if blob deletion fails
    }
  }

  return true
}

/**
 * Validates if a chunk is informative enough to be embedded
 *
 * @param text - Chunk text content
 * @returns True if chunk is informative
 */
function isInformativeChunk(text: string): boolean {
  if (!text || text.trim() === "") {
    return false
  }

  // ENHANCED: Less restrictive check for markdown content
  if (text.includes("#") || text.includes("|") || text.includes("```")) {
    return true // Consider markdown headings, tables, and code blocks as informative
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
 * Calculate histogram of chunk sizes for debugging
 *
 * @param chunks - Array of text chunks
 * @returns Histogram object with size ranges and counts
 */
function calculateChunkSizeHistogram(chunks: string[]): Record<string, number> {
  const histogram: Record<string, number> = {
    "0-100": 0,
    "101-250": 0,
    "251-500": 0,
    "501-750": 0,
    "751-1000": 0,
    "1001+": 0,
  }

  chunks.forEach((chunk) => {
    const size = chunk.length
    if (size <= 100) histogram["0-100"]++
    else if (size <= 250) histogram["101-250"]++
    else if (size <= 500) histogram["251-500"]++
    else if (size <= 750) histogram["501-750"]++
    else if (size <= 1000) histogram["751-1000"]++
    else histogram["1001+"]++
  })

  return histogram
}
