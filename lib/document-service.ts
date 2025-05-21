/**
 * Document Service
 *
 * Comprehensive service for handling document processing operations in a serverless Edge runtime context.
 * Provides methods for processing, retrieving, listing, deleting, retrying, and checking document status.
 *
 * Features:
 * - Streaming document processing with progress tracking
 * - Efficient batch processing for large documents
 * - Comprehensive error handling with retry mechanisms
 * - Metadata management and filtering
 * - Edge runtime compatible (no Node.js specific modules)
 *
 * @module lib/document-service
 */

import { logger } from "@/lib/utils/logger"
import {
  upsertVectors,
  queryVectors,
  deleteVectors,
  createPlaceholderVector,
  type PineconeVector,
} from "@/lib/pinecone-rest-client"
import { generateEmbeddings } from "@/lib/embedding-service"
import { chunkDocument, splitByHeaders, isInformativeChunk } from "@/lib/chunking-utils"
import { EMBEDDING_MODEL, VECTOR_DIMENSION } from "@/lib/embedding-config"
import type { Document, ProcessDocumentOptions } from "@/types"

// Constants for processing
const MAX_CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 150
const EMBEDDING_BATCH_SIZE = 10
const UPSERT_BATCH_SIZE = 100
const MAX_RETRIES = 3

/**
 * Document processing error class
 */
export class DocumentProcessingError extends Error {
  code: string
  retryable: boolean
  context?: Record<string, any>

  constructor(
    message: string,
    options: {
      code?: string
      retryable?: boolean
      context?: Record<string, any>
    } = {},
  ) {
    super(message)
    this.name = "DocumentProcessingError"
    this.code = options.code || "unknown_error"
    this.retryable = options.retryable ?? false
    this.context = options.context
  }
}

/**
 * Document status interface
 */
export interface DocumentStatus {
  id: string
  status: "processing" | "indexed" | "failed"
  progress: number
  message?: string
  error?: string
  updatedAt: string
}

/**
 * Document processing result interface
 */
export interface DocumentProcessingResult {
  documentId: string
  status: "success" | "partial_success" | "failed"
  totalChunks: number
  successfulChunks: number
  failedChunks: number
  processingTime: number
  error?: string
  warnings?: string[]
}

/**
 * Document list result interface
 */
export interface DocumentListResult {
  documents: Document[]
  total: number
  hasMore: boolean
}

/**
 * Pagination options interface
 */
export interface PaginationOptions {
  limit?: number
  offset?: number
  sortBy?: string
  sortDirection?: "asc" | "desc"
}

/**
 * Document processing options interface
 */
export interface DocumentProcessingOptions {
  chunkingStrategy?: "fixed" | "semantic" | "hybrid"
  maxChunkSize?: number
  chunkOverlap?: number
  embeddingBatchSize?: number
  namespace?: string
  onProgress?: (progress: DocumentProcessingProgress) => void
}

/**
 * Document processing progress interface
 */
export interface DocumentProcessingProgress {
  stage: string
  progress: number
  message: string
  details?: Record<string, any>
}

/**
 * Document service class
 */
export class DocumentService {
  /**
   * Process a document
   *
   * @param documentId - Document ID
   * @param content - Document content
   * @param metadata - Document metadata
   * @param options - Processing options
   * @returns Processing result
   */
  public async processDocument(
    documentId: string,
    content: string,
    metadata: Partial<Document>,
    options: DocumentProcessingOptions = {},
  ): Promise<DocumentProcessingResult> {
    const startTime = performance.now()

    // Set default options
    const {
      chunkingStrategy = "semantic",
      maxChunkSize = MAX_CHUNK_SIZE,
      chunkOverlap = CHUNK_OVERLAP,
      embeddingBatchSize = EMBEDDING_BATCH_SIZE,
      namespace = "",
      onProgress,
    } = options

    // Initialize result
    const result: DocumentProcessingResult = {
      documentId,
      status: "failed",
      totalChunks: 0,
      successfulChunks: 0,
      failedChunks: 0,
      processingTime: 0,
      warnings: [],
    }

    // Debug info for tracking processing steps
    const debugInfo: Record<string, any> = {
      processingStartTime: new Date().toISOString(),
      options: {
        chunkingStrategy,
        maxChunkSize,
        chunkOverlap,
        embeddingBatchSize,
      },
      steps: {},
      timings: {},
    }

    try {
      // Report progress: Starting
      this.reportProgress(onProgress, {
        stage: "starting",
        progress: 0,
        message: "Starting document processing",
      })

      // Validate document
      logger.info(`Validating document: ${documentId}`, { documentId })

      if (!content || content.trim() === "") {
        throw new DocumentProcessingError("Document content is empty", {
          code: "empty_content",
          context: { documentId },
        })
      }

      if (!documentId) {
        throw new DocumentProcessingError("Document ID is required", {
          code: "missing_id",
          context: { documentId },
        })
      }

      const validatedContent = content.trim()
      debugInfo.steps.validation = {
        success: true,
        contentLength: validatedContent.length,
      }

      // Update document status to processing
      await this.updateDocumentStatus(documentId, "processing", 5, "Document validated, starting chunking", debugInfo)

      // Report progress: Validation complete
      this.reportProgress(onProgress, {
        stage: "validated",
        progress: 5,
        message: "Document validated successfully",
        details: { contentLength: validatedContent.length },
      })

      // Chunk document based on strategy
      logger.info(`Chunking document: ${documentId} using ${chunkingStrategy} strategy`, {
        documentId,
        strategy: chunkingStrategy,
      })

      const chunkingStartTime = performance.now()
      let chunks: string[] = []

      switch (chunkingStrategy) {
        case "fixed":
          chunks = chunkDocument(validatedContent, maxChunkSize, chunkOverlap)
          break
        case "semantic":
          // First try to split by headers for semantic chunking
          const sections = splitByHeaders(validatedContent)

          // Process each section
          for (const section of sections) {
            const sectionText = section.header ? `# ${section.header}\n\n${section.content}` : section.content

            const sectionChunks = chunkDocument(sectionText, maxChunkSize, chunkOverlap)
            chunks.push(...sectionChunks)
          }
          break
        case "hybrid":
          // First try semantic chunking
          const semanticSections = splitByHeaders(validatedContent)

          if (semanticSections.length > 1) {
            // If we have multiple sections, process each one
            for (const section of semanticSections) {
              const sectionText = section.header ? `# ${section.header}\n\n${section.content}` : section.content

              const sectionChunks = chunkDocument(sectionText, maxChunkSize, chunkOverlap)
              chunks.push(...sectionChunks)
            }
          } else {
            // Otherwise, fall back to fixed-size chunking
            chunks = chunkDocument(validatedContent, maxChunkSize, chunkOverlap)
          }
          break
        default:
          chunks = chunkDocument(validatedContent, maxChunkSize, chunkOverlap)
      }

      const chunkingTime = performance.now() - chunkingStartTime
      debugInfo.timings.chunking = chunkingTime

      // Filter out non-informative chunks
      const validChunks = chunks.filter((chunk) => isInformativeChunk(chunk))

      debugInfo.steps.chunking = {
        strategy: chunkingStrategy,
        totalChunks: chunks.length,
        validChunks: validChunks.length,
        skippedChunks: chunks.length - validChunks.length,
        chunkSizes: validChunks.map((c) => c.length),
        averageChunkSize: validChunks.reduce((sum, c) => sum + c.length, 0) / validChunks.length,
      }

      // Check if we have any valid chunks
      if (validChunks.length === 0) {
        throw new DocumentProcessingError("No valid content chunks could be extracted from document", {
          code: "no_valid_chunks",
          context: { documentId, totalChunks: chunks.length },
        })
      }

      // Update document status
      await this.updateDocumentStatus(
        documentId,
        "processing",
        20,
        `Chunking complete. Generated ${validChunks.length} chunks.`,
        debugInfo,
      )

      // Report progress: Chunking complete
      this.reportProgress(onProgress, {
        stage: "chunked",
        progress: 20,
        message: `Document chunked into ${validChunks.length} valid chunks`,
        details: {
          totalChunks: chunks.length,
          validChunks: validChunks.length,
          strategy: chunkingStrategy,
        },
      })

      // Generate embeddings for chunks
      logger.info(`Generating embeddings for ${validChunks.length} chunks: ${documentId}`, {
        documentId,
        chunkCount: validChunks.length,
      })

      const embeddingStartTime = performance.now()
      let successfulEmbeddings = 0
      let failedEmbeddings = 0
      let totalVectorsInserted = 0

      // Process in batches
      const batchCount = Math.ceil(validChunks.length / embeddingBatchSize)

      debugInfo.steps.embedding = {
        batches: [],
        totalBatches: batchCount,
        embeddingModel: EMBEDDING_MODEL,
      }

      // Generate embeddings for all chunks
      const embeddings = await generateEmbeddings(validChunks, {
        batchSize: embeddingBatchSize,
        onProgress: (completed, total) => {
          const progress = Math.floor(20 + (completed / total) * 40)

          // Update document status
          this.updateDocumentStatus(
            documentId,
            "processing",
            progress,
            `Generating embeddings: ${completed}/${total} chunks`,
            debugInfo,
          ).catch((err) => {
            logger.error(`Failed to update status during embedding generation`, {
              documentId,
              error: err instanceof Error ? err.message : "Unknown error",
            })
          })

          // Report progress
          this.reportProgress(onProgress, {
            stage: "embedding",
            progress,
            message: `Generating embeddings: ${completed}/${total} chunks`,
            details: {
              completed,
              total,
              percent: Math.round((completed / total) * 100),
            },
          })
        },
      })

      // Prepare vectors for Pinecone
      const vectors: PineconeVector[] = []

      for (let i = 0; i < validChunks.length; i++) {
        const chunk = validChunks[i]
        const embedding = embeddings[i]

        // Skip if embedding generation failed
        if (!embedding || embedding.length !== VECTOR_DIMENSION) {
          failedEmbeddings++
          continue
        }

        // Create chunk ID
        const chunkId = `chunk_${documentId}_${i}`

        // Create timestamp for metadata
        const timestamp = new Date().toISOString()

        // Create vector with metadata
        vectors.push({
          id: chunkId,
          values: embedding,
          metadata: {
            content: chunk,
            document_id: documentId,
            document_name: metadata.name || "",
            document_type: metadata.file_type || "",
            user_id: metadata.user_id || "",
            index: i,
            record_type: "chunk",
            created_at: timestamp,
            updated_at: timestamp,
            embedding_model: EMBEDDING_MODEL,
          },
        })

        successfulEmbeddings++
      }

      const embeddingTime = performance.now() - embeddingStartTime
      debugInfo.timings.embedding = embeddingTime

      debugInfo.steps.embedding.successfulEmbeddings = successfulEmbeddings
      debugInfo.steps.embedding.failedEmbeddings = failedEmbeddings

      // Check if we have any successful embeddings
      if (successfulEmbeddings === 0) {
        throw new DocumentProcessingError("Failed to generate any valid embeddings", {
          code: "embedding_generation_failed",
          context: { documentId, totalChunks: validChunks.length },
        })
      }

      // Update document status
      await this.updateDocumentStatus(
        documentId,
        "processing",
        60,
        `Embedding generation complete. Storing vectors.`,
        debugInfo,
      )

      // Report progress: Embeddings complete
      this.reportProgress(onProgress, {
        stage: "embeddings_complete",
        progress: 60,
        message: `Embedding generation complete. Storing vectors.`,
        details: {
          successfulEmbeddings,
          failedEmbeddings,
        },
      })

      // Store vectors in Pinecone
      logger.info(`Storing ${vectors.length} vectors for document: ${documentId}`, {
        documentId,
        vectorCount: vectors.length,
      })

      const storageStartTime = performance.now()

      // Process in batches
      for (let i = 0; i < vectors.length; i += UPSERT_BATCH_SIZE) {
        const batch = vectors.slice(i, i + UPSERT_BATCH_SIZE)
        const batchProgress = Math.floor(60 + (i / vectors.length) * 30)

        // Update document status
        await this.updateDocumentStatus(
          documentId,
          "processing",
          batchProgress,
          `Storing vectors: ${i + batch.length}/${vectors.length}`,
          debugInfo,
        )

        // Report progress
        this.reportProgress(onProgress, {
          stage: "storing",
          progress: batchProgress,
          message: `Storing vectors: ${i + batch.length}/${vectors.length}`,
          details: {
            completed: i + batch.length,
            total: vectors.length,
            percent: Math.round(((i + batch.length) / vectors.length) * 100),
          },
        })

        // Store batch with retry logic
        const upsertResult = await this.retryOperation(
          () => upsertVectors(batch, { namespace }),
          `Upsert vectors batch ${i / UPSERT_BATCH_SIZE + 1}/${Math.ceil(vectors.length / UPSERT_BATCH_SIZE)}`,
        )

        totalVectorsInserted += upsertResult.upsertedCount
      }

      const storageTime = performance.now() - storageStartTime
      debugInfo.timings.storage = storageTime

      debugInfo.steps.storage = {
        totalVectorsInserted,
        namespace,
      }

      // Create document metadata vector
      const documentMetadata = {
        id: documentId,
        user_id: metadata.user_id || "",
        name: metadata.name || "",
        description: metadata.description || "",
        file_type: metadata.file_type || "",
        file_size: metadata.file_size || content.length,
        file_path: metadata.file_path || "",
        blob_url: metadata.blob_url,
        status: "indexed",
        processing_progress: 100,
        chunk_count: successfulEmbeddings,
        embedding_model: EMBEDDING_MODEL,
        created_at: metadata.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        record_type: "document",
        debug_info: debugInfo,
      }

      // Create placeholder vector for document metadata
      const placeholderVector = createPlaceholderVector()

      // Store document metadata
      await upsertVectors(
        [
          {
            id: documentId,
            values: placeholderVector,
            metadata: documentMetadata,
          },
        ],
        { namespace },
      )

      // Calculate total processing time
      const totalTime = performance.now() - startTime
      debugInfo.timings.total = totalTime
      debugInfo.processingEndTime = new Date().toISOString()

      // Update result
      result.status = failedEmbeddings > 0 ? "partial_success" : "success"
      result.totalChunks = validChunks.length
      result.successfulChunks = successfulEmbeddings
      result.failedChunks = failedEmbeddings
      result.processingTime = totalTime

      // Report progress: Complete
      this.reportProgress(onProgress, {
        stage: "complete",
        progress: 100,
        message: "Document processing complete",
        details: {
          totalChunks: validChunks.length,
          successfulChunks: successfulEmbeddings,
          failedChunks: failedEmbeddings,
          processingTime: totalTime,
        },
      })

      logger.info(`Document processing complete: ${documentId}`, {
        documentId,
        status: result.status,
        totalChunks: result.totalChunks,
        successfulChunks: result.successfulChunks,
        failedChunks: result.failedChunks,
        processingTime: result.processingTime,
      })

      return result
    } catch (error) {
      // Calculate processing time even for failures
      const totalTime = performance.now() - startTime

      // Log error
      logger.error(`Document processing failed: ${documentId}`, {
        documentId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })

      // Update debug info
      debugInfo.error = error instanceof Error ? error.message : "Unknown error"
      debugInfo.errorStack = error instanceof Error ? error.stack : undefined
      debugInfo.processingEndTime = new Date().toISOString()
      debugInfo.timings.total = totalTime

      // Try to update document status to failed
      try {
        await this.updateDocumentStatus(
          documentId,
          "failed",
          0,
          error instanceof Error ? error.message : "Unknown error in document processing",
          debugInfo,
        )
      } catch (statusError) {
        logger.error(`Failed to update document status after error: ${documentId}`, {
          documentId,
          error: statusError instanceof Error ? statusError.message : "Unknown error",
        })
      }

      // Update result
      result.status = "failed"
      result.processingTime = totalTime
      result.error = error instanceof Error ? error.message : "Unknown error in document processing"

      // Report progress: Failed
      this.reportProgress(onProgress, {
        stage: "failed",
        progress: 0,
        message: error instanceof Error ? error.message : "Unknown error in document processing",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
          processingTime: totalTime,
        },
      })

      // Rethrow as DocumentProcessingError
      if (error instanceof DocumentProcessingError) {
        throw error
      }

      throw new DocumentProcessingError(
        `Document processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          code: "processing_failed",
          context: { documentId, debugInfo },
        },
      )
    }
  }

  /**
   * Process document from URL
   *
   * @param options - Document processing options
   * @returns Processing result
   */
  public async processDocumentFromUrl(
    options: ProcessDocumentOptions & {
      processingOptions?: DocumentProcessingOptions
    },
  ): Promise<DocumentProcessingResult> {
    const { documentId, userId, filePath, fileName, fileType, fileUrl, processingOptions } = options

    try {
      logger.info(`Processing document from URL: ${documentId}`, {
        documentId,
        fileName,
        fileType,
      })

      // Fetch document content
      const response = await fetch(fileUrl, { cache: "no-store" })

      if (!response.ok) {
        throw new DocumentProcessingError(
          `Failed to fetch document content: ${response.status} ${response.statusText}`,
          {
            code: "fetch_failed",
            context: { documentId, status: response.status },
          },
        )
      }

      const content = await response.text()

      // Create document metadata
      const metadata: Partial<Document> = {
        id: documentId,
        user_id: userId,
        name: fileName,
        file_type: fileType,
        file_size: content.length,
        file_path: filePath,
        blob_url: fileUrl,
        status: "processing",
        processing_progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Process document
      return await this.processDocument(documentId, content, metadata, processingOptions)
    } catch (error) {
      logger.error(`Failed to process document from URL: ${documentId}`, {
        documentId,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      // Rethrow as DocumentProcessingError
      if (error instanceof DocumentProcessingError) {
        throw error
      }

      throw new DocumentProcessingError(
        `Failed to process document from URL: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          code: "url_processing_failed",
          context: { documentId, fileName, fileType },
        },
      )
    }
  }

  /**
   * Get document by ID
   *
   * @param id - Document ID
   * @returns Document or null if not found
   */
  public async getDocument(id: string): Promise<Document | null> {
    try {
      logger.info(`Getting document: ${id}`, { id })

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Query for the document
      const response = await queryVectors(placeholderVector, {
        filter: {
          id: { $eq: id },
          record_type: { $eq: "document" },
        },
        includeMetadata: true,
        topK: 1,
      })

      // Check if document was found
      if (!response.matches || response.matches.length === 0) {
        logger.info(`Document not found: ${id}`, { id })
        return null
      }

      // Extract document from metadata
      const match = response.matches[0]
      const document: Document = {
        id: match.id,
        user_id: match.metadata?.user_id as string,
        name: match.metadata?.name as string,
        description: match.metadata?.description as string,
        file_type: match.metadata?.file_type as string,
        file_size: match.metadata?.file_size as number,
        file_path: match.metadata?.file_path as string,
        blob_url: match.metadata?.blob_url as string | undefined,
        status: match.metadata?.status as "processing" | "indexed" | "failed",
        processing_progress: match.metadata?.processing_progress as number,
        error_message: match.metadata?.error_message as string | undefined,
        created_at: match.metadata?.created_at as string,
        updated_at: match.metadata?.updated_at as string,
        chunk_count: match.metadata?.chunk_count as number | undefined,
        embedding_model: match.metadata?.embedding_model as string | undefined,
        debug_info: match.metadata?.debug_info as Record<string, any> | undefined,
      }

      return document
    } catch (error) {
      logger.error(`Error getting document: ${id}`, {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      throw new DocumentProcessingError(
        `Failed to get document: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          code: "get_document_failed",
          context: { documentId: id },
        },
      )
    }
  }

  /**
   * List documents with filtering and pagination
   *
   * @param filters - Document filters
   * @param pagination - Pagination options
   * @returns Document list result
   */
  public async listDocuments(
    filters: {
      userId?: string
      status?: "processing" | "indexed" | "failed"
      fileType?: string
      dateRange?: { from?: Date; to?: Date }
      search?: string
    } = {},
    pagination: PaginationOptions = {},
  ): Promise<DocumentListResult> {
    try {
      // Set default pagination options
      const { limit = 10, offset = 0, sortBy = "created_at", sortDirection = "desc" } = pagination

      logger.info(`Listing documents with filters`, {
        filters,
        pagination: { limit, offset, sortBy, sortDirection },
      })

      // Build filter
      const filter: Record<string, any> = {
        record_type: "document",
      }

      if (filters.userId) {
        filter.user_id = { $eq: filters.userId }
      }

      if (filters.status) {
        filter.status = { $eq: filters.status }
      }

      if (filters.fileType) {
        filter.file_type = { $eq: filters.fileType }
      }

      if (filters.dateRange) {
        filter.created_at = {}

        if (filters.dateRange.from) {
          filter.created_at.$gte = filters.dateRange.from.toISOString()
        }

        if (filters.dateRange.to) {
          filter.created_at.$lte = filters.dateRange.to.toISOString()
        }
      }

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Query for documents
      const response = await queryVectors(placeholderVector, {
        filter,
        includeMetadata: true,
        topK: limit + offset + 1, // Get one extra to check if there are more
      })

      // Extract documents from metadata
      const matches = response.matches || []
      const total = matches.length
      const hasMore = total > limit + offset

      // Apply pagination
      const paginatedMatches = matches.slice(offset, offset + limit)

      // Convert matches to documents
      const documents: Document[] = paginatedMatches.map((match) => ({
        id: match.id,
        user_id: match.metadata?.user_id as string,
        name: match.metadata?.name as string,
        description: match.metadata?.description as string,
        file_type: match.metadata?.file_type as string,
        file_size: match.metadata?.file_size as number,
        file_path: match.metadata?.file_path as string,
        blob_url: match.metadata?.blob_url as string | undefined,
        status: match.metadata?.status as "processing" | "indexed" | "failed",
        processing_progress: match.metadata?.processing_progress as number,
        error_message: match.metadata?.error_message as string | undefined,
        created_at: match.metadata?.created_at as string,
        updated_at: match.metadata?.updated_at as string,
        chunk_count: match.metadata?.chunk_count as number | undefined,
        embedding_model: match.metadata?.embedding_model as string | undefined,
      }))

      // Sort documents if needed
      if (sortBy) {
        documents.sort((a, b) => {
          const valueA = (a as any)[sortBy]
          const valueB = (b as any)[sortBy]

          if (valueA < valueB) return sortDirection === "asc" ? -1 : 1
          if (valueA > valueB) return sortDirection === "asc" ? 1 : -1
          return 0
        })
      }

      return {
        documents,
        total,
        hasMore,
      }
    } catch (error) {
      logger.error(`Error listing documents`, {
        filters,
        pagination,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      throw new DocumentProcessingError(
        `Failed to list documents: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          code: "list_documents_failed",
          context: { filters, pagination },
        },
      )
    }
  }

  /**
   * Delete document and all its chunks
   *
   * @param id - Document ID
   * @returns True if deletion was successful
   */
  public async deleteDocument(id: string): Promise<boolean> {
    try {
      logger.info(`Deleting document: ${id}`, { id })

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Find all chunks for this document
      const chunkResponse = await queryVectors(placeholderVector, {
        filter: {
          document_id: { $eq: id },
          record_type: { $eq: "chunk" },
        },
        includeMetadata: false,
        topK: 1000, // Adjust based on expected maximum chunks
      })

      // Get chunk IDs
      const chunkIds = chunkResponse.matches?.map((match) => match.id) || []

      logger.info(`Found ${chunkIds.length} chunks to delete for document: ${id}`, {
        id,
        chunkCount: chunkIds.length,
      })

      // Delete chunks if any were found
      if (chunkIds.length > 0) {
        // Delete in batches of 100
        for (let i = 0; i < chunkIds.length; i += 100) {
          const batchIds = chunkIds.slice(i, i + 100)
          await deleteVectors({ ids: batchIds })
        }
      }

      // Delete document
      await deleteVectors({ ids: [id] })

      logger.info(`Document deleted successfully: ${id}`, { id })
      return true
    } catch (error) {
      logger.error(`Error deleting document: ${id}`, {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      throw new DocumentProcessingError(
        `Failed to delete document: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          code: "delete_document_failed",
          context: { documentId: id },
        },
      )
    }
  }

  /**
   * Retry document processing
   *
   * @param id - Document ID
   * @returns Processing result
   */
  public async retryProcessing(id: string): Promise<DocumentProcessingResult> {
    try {
      logger.info(`Retrying document processing: ${id}`, { id })

      // Get document
      const document = await this.getDocument(id)

      if (!document) {
        throw new DocumentProcessingError(`Document not found: ${id}`, {
          code: "document_not_found",
          context: { documentId: id },
        })
      }

      // Check if document has a blob URL
      if (!document.blob_url) {
        throw new DocumentProcessingError(`Document has no blob URL: ${id}`, {
          code: "no_blob_url",
          context: { documentId: id },
        })
      }

      // Fetch document content
      const response = await fetch(document.blob_url, { cache: "no-store" })

      if (!response.ok) {
        throw new DocumentProcessingError(
          `Failed to fetch document content: ${response.status} ${response.statusText}`,
          {
            code: "fetch_failed",
            context: { documentId: id, status: response.status },
          },
        )
      }

      const content = await response.text()

      // Delete existing document chunks
      await this.deleteDocument(id)

      // Process document
      return await this.processDocument(id, content, document)
    } catch (error) {
      logger.error(`Error retrying document processing: ${id}`, {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      // Rethrow as DocumentProcessingError
      if (error instanceof DocumentProcessingError) {
        throw error
      }

      throw new DocumentProcessingError(
        `Failed to retry document processing: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          code: "retry_processing_failed",
          context: { documentId: id },
        },
      )
    }
  }

  /**
   * Get document status
   *
   * @param id - Document ID
   * @returns Document status
   */
  public async getDocumentStatus(id: string): Promise<DocumentStatus | null> {
    try {
      logger.info(`Getting document status: ${id}`, { id })

      // Get document
      const document = await this.getDocument(id)

      if (!document) {
        return null
      }

      return {
        id: document.id,
        status: document.status,
        progress: document.processing_progress || 0,
        message: document.error_message,
        error: document.status === "failed" ? document.error_message : undefined,
        updatedAt: document.updated_at,
      }
    } catch (error) {
      logger.error(`Error getting document status: ${id}`, {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      throw new DocumentProcessingError(
        `Failed to get document status: ${error instanceof Error ? error.message : "Unknown error"}`,
        {
          code: "get_status_failed",
          context: { documentId: id },
        },
      )
    }
  }

  /**
   * Get document statistics
   *
   * @param userId - Optional user ID to filter by
   * @returns Document statistics
   */
  public async getDocumentStats(userId?: string): Promise<{
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    averageChunks: number
  }> {
    try {
      // Build filter
      const filter: Record<string, any> = {
        record_type: "document",
      }

      if (userId) {
        filter.user_id = { $eq: userId }
      }

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Query for documents
      const response = await queryVectors(placeholderVector, {
        filter,
        includeMetadata: true,
        topK: 1000, // Adjust based on expected maximum documents
      })

      // Extract documents from metadata
      const documents = response.matches?.map((match) => match.metadata as Document).filter(Boolean) || []

      // Calculate statistics
      const total = documents.length
      const byStatus: Record<string, number> = {}
      const byType: Record<string, number> = {}
      let totalChunks = 0

      for (const doc of documents) {
        // Count by status
        const status = doc.status || "unknown"
        byStatus[status] = (byStatus[status] || 0) + 1

        // Count by type
        const type = doc.file_type || "unknown"
        byType[type] = (byType[type] || 0) + 1

        // Sum chunks
        totalChunks += doc.chunk_count || 0
      }

      // Calculate average chunks per document
      const averageChunks = total > 0 ? totalChunks / total : 0

      return {
        total,
        byStatus,
        byType,
        averageChunks,
      }
    } catch (error) {
      logger.error(`Error getting document statistics`, {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      // Return empty statistics
      return {
        total: 0,
        byStatus: {},
        byType: {},
        averageChunks: 0,
      }
    }
  }

  /**
   * Update document status
   *
   * @param documentId - Document ID
   * @param status - New status
   * @param progress - Processing progress (0-100)
   * @param message - Status message
   * @param debugInfo - Additional debug information
   */
  private async updateDocumentStatus(
    documentId: string,
    status: "processing" | "indexed" | "failed",
    progress = 0,
    message = "",
    debugInfo: Record<string, any> = {},
  ): Promise<void> {
    try {
      logger.info(`Updating document status: ${documentId} -> ${status}`, {
        documentId,
        status,
        progress,
        message,
      })

      // Get current document metadata
      const document = await this.getDocument(documentId)

      // If document doesn't exist, create a placeholder
      const metadata = document || {
        id: documentId,
        status: "processing",
        processing_progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Update metadata
      const updatedMetadata = {
        ...metadata,
        status,
        processing_progress: progress,
        error_message: status === "failed" ? message : undefined,
        updated_at: new Date().toISOString(),
      }

      // If debug info is provided, merge it with existing debug info
      if (Object.keys(debugInfo).length > 0) {
        updatedMetadata.debug_info = {
          ...(metadata.debug_info || {}),
          ...debugInfo,
          lastUpdate: {
            timestamp: new Date().toISOString(),
            status,
            message,
          },
        }
      }

      // Create placeholder vector
      const placeholderVector = createPlaceholderVector()

      // Update document vector
      await upsertVectors([
        {
          id: documentId,
          values: placeholderVector,
          metadata: {
            ...updatedMetadata,
            record_type: "document",
          },
        },
      ])
    } catch (error) {
      logger.error(`Failed to update document status: ${documentId}`, {
        documentId,
        status,
        error: error instanceof Error ? error.message : "Unknown error",
      })

      // Don't throw here to avoid breaking the main processing flow
      // Just log the error and continue
    }
  }

  /**
   * Report progress to callback if provided
   *
   * @param onProgress - Progress callback
   * @param progress - Progress data
   */
  private reportProgress(
    onProgress: ((progress: DocumentProcessingProgress) => void) | undefined,
    progress: DocumentProcessingProgress,
  ): void {
    if (onProgress) {
      try {
        onProgress(progress)
      } catch (error) {
        logger.error("Error in progress callback", {
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }
  }

  /**
   * Retry an operation with exponential backoff
   *
   * @param operation - Operation to retry
   * @param operationName - Name of the operation for logging
   * @param maxRetries - Maximum number of retries
   * @returns Operation result
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = MAX_RETRIES,
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // If this was the last retry, throw the error
        if (attempt >= maxRetries) {
          logger.error(`${operationName} failed after ${maxRetries} retries`, {
            operationName,
            error: lastError.message,
          })
          throw lastError
        }

        // Calculate backoff time with jitter
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 30000)
        const jitter = Math.random() * 0.3 * backoffTime // Add up to 30% jitter
        const waitTime = backoffTime + jitter

        logger.warn(`${operationName} failed, retrying in ${Math.round(waitTime)}ms (${attempt + 1}/${maxRetries})`, {
          operationName,
          attempt: attempt + 1,
          maxRetries,
          waitTime: Math.round(waitTime),
          error: lastError.message,
        })

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    // This should never happen due to the throw in the loop
    throw lastError || new Error(`Unknown error in ${operationName}`)
  }
}

// Export singleton instance
export const documentService = new DocumentService()

/**
 * Validate document input
 *
 * @param input - Document input to validate
 * @returns Validated document input
 * @throws Error if validation fails
 */
export function validateDocumentInput(input: any): {
  userId: string
  name: string
  description?: string
  fileType: string
  fileSize: number
  filePath: string
  tags?: string[]
} {
  if (!input) {
    throw new Error("Document input is required")
  }

  if (!input.userId) {
    throw new Error("User ID is required")
  }

  if (!input.name) {
    throw new Error("Document name is required")
  }

  if (!input.fileType) {
    throw new Error("File type is required")
  }

  if (!input.fileSize && input.fileSize !== 0) {
    throw new Error("File size is required")
  }

  if (!input.filePath) {
    throw new Error("File path is required")
  }

  return {
    userId: input.userId,
    name: input.name,
    description: input.description,
    fileType: input.fileType,
    fileSize: input.fileSize,
    filePath: input.filePath,
    tags: input.tags,
  }
}

/**
 * Generate a unique document ID
 *
 * @returns Unique document ID
 */
export function generateDocumentId(): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  return `doc_${timestamp}_${random}`
}

/**
 * Get document by ID from API
 *
 * @param id - Document ID
 * @returns Document or null if not found
 */
export async function fetchDocumentById(id: string): Promise<Document | null> {
  try {
    const document = await documentService.getDocument(id)
    return document
  } catch (error) {
    logger.error(`Failed to fetch document by ID: ${id}`, {
      id,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return null
  }
}

/**
 * Get documents by user ID
 *
 * @param userId - User ID
 * @param options - Additional options
 * @returns Documents and total count
 */
export async function getDocumentsByUserId(
  userId: string,
  options: {
    filters?: any
    sort?: { field: string; direction: "asc" | "desc" }
    pagination?: { limit: number; offset: number }
  } = {},
): Promise<{ documents: Document[]; total: number }> {
  try {
    const {
      filters = {},
      sort = { field: "created_at", direction: "desc" },
      pagination = { limit: 10, offset: 0 },
    } = options

    const result = await documentService.listDocuments(
      { userId, ...filters },
      {
        limit: pagination.limit,
        offset: pagination.offset,
        sortBy: sort.field,
        sortDirection: sort.direction,
      },
    )

    return {
      documents: result.documents,
      total: result.total,
    }
  } catch (error) {
    logger.error(`Failed to get documents by user ID: ${userId}`, {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return {
      documents: [],
      total: 0,
    }
  }
}

/**
 * Get document statistics
 *
 * @param userId - User ID
 * @returns Document statistics
 */
export async function getDocumentStats(userId: string): Promise<{
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  averageChunks: number
}> {
  return documentService.getDocumentStats(userId)
}

/**
 * Create a new document
 *
 * @param content Document content
 * @param metadata Document metadata
 * @returns Created document
 */
export async function createDocument(content: string, metadata: Partial<Document>): Promise<Document> {
  // Generate a document ID if not provided
  const documentId = metadata.id || generateDocumentId()

  try {
    // Process the document
    const result = await documentService.processDocument(documentId, content, metadata)

    // Get the processed document
    const document = await documentService.getDocument(documentId)

    if (!document) {
      throw new DocumentProcessingError(`Failed to retrieve created document: ${documentId}`, {
        code: "document_not_found",
        context: { documentId },
      })
    }

    return document
  } catch (error) {
    logger.error(`Error creating document: ${documentId}`, {
      documentId,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    throw new DocumentProcessingError(
      `Failed to create document: ${error instanceof Error ? error.message : "Unknown error"}`,
      {
        code: "document_creation_failed",
        context: { documentId },
      },
    )
  }
}
