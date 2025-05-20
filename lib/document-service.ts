/**
 * Document Service
 *
 * Handles document operations including creation, retrieval, and processing.
 */

import { upsertVectors, queryVectors, deleteVectors } from "@/lib/pinecone-rest-client"
import { chunkDocument } from "@/lib/chunking-utils"
import { generateEmbedding } from "@/lib/embedding-service"
import type { Document, ProcessDocumentOptions, ChunkMetadata } from "@/types"
import { logger } from "@/lib/utils/logger"

/**
 * Create a new document
 */
export async function createDocument(
  userId: string,
  name: string,
  description?: string,
  fileType?: string,
  fileSize?: number,
  filePath?: string,
): Promise<Document> {
  console.log(`Creating document record`, { userId, name })

  // Generate a unique ID for the document
  const id = `doc_${crypto.randomUUID().replace(/-/g, "")}`

  const now = new Date().toISOString()

  // Create document metadata
  const document: Document = {
    id,
    user_id: userId,
    name,
    description: description || "",
    file_type: fileType || "",
    file_size: fileSize || 0,
    file_path: filePath || "",
    status: "processing",
    processing_progress: 0,
    error_message: "",
    created_at: now,
    updated_at: now,
  }

  // Validate document before proceeding
  if (!document?.id || typeof document.id !== "string") {
    console.error("Failed to generate valid document ID", { document })
    throw new Error("Failed to generate valid document ID")
  }

  // Store document metadata in Pinecone
  try {
    await upsertVectors(
      [
        {
          id: `meta_${id}`,
          values: new Array(3072).fill(0.001), // Small non-zero vector for metadata (3072 for text-embedding-3-large)
          metadata: {
            record_type: "document_metadata",
            document_id: id,
            user_id: userId,
            name,
            description: description || "",
            file_type: fileType || "",
            file_size: fileSize || 0,
            file_path: filePath || "",
            status: "processing",
            processing_progress: 0,
            error_message: "",
            created_at: now,
            updated_at: now,
          },
        },
      ],
      "metadata",
    )

    console.log(`Document metadata stored in Pinecone`, { documentId: id })
  } catch (error) {
    // Log error but don't fail the document creation
    console.error(`Error storing document metadata in Pinecone`, {
      documentId: id,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    console.warn(`Continuing with document creation despite Pinecone error`, { documentId: id })
    // We don't rethrow here to allow document creation to succeed even if Pinecone fails
  }

  return document
}

/**
 * Get documents by user ID
 */
export async function getDocumentsByUserId(userId: string): Promise<Document[]> {
  console.log(`Getting documents for user`, { userId })

  try {
    // Create a dummy vector for querying
    const dummyVector = new Array(3072).fill(0.001) // 3072 for text-embedding-3-large

    // Query Pinecone for document metadata
    const result = await queryVectors(
      dummyVector,
      10000, // High limit to get all documents
      true, // Include metadata
      {
        record_type: "document_metadata",
        user_id: userId,
      },
      "metadata",
    )

    if (!result.matches || result.error) {
      console.error(`Error querying Pinecone for documents`, {
        userId,
        error: result.errorMessage || "Unknown error",
      })
      return []
    }

    // Map Pinecone results to Document objects
    const documents = result.matches
      .map((match) => {
        const metadata = match.metadata || {}
        return {
          id: metadata.document_id || "",
          user_id: metadata.user_id || "",
          name: metadata.name || "",
          description: metadata.description || "",
          file_type: metadata.file_type || "",
          file_size: metadata.file_size || 0,
          file_path: metadata.file_path || "",
          status: metadata.status || "processing",
          processing_progress: metadata.processing_progress || 0,
          error_message: metadata.error_message || "",
          created_at: metadata.created_at || new Date().toISOString(),
          updated_at: metadata.updated_at || new Date().toISOString(),
        }
      })
      .filter((doc) => doc.id) // Filter out documents with no ID

    console.log(`Found ${documents.length} documents for user`, { userId })
    return documents
  } catch (error) {
    console.error(`Error getting documents for user`, {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return []
  }
}

/**
 * Update document status
 */
async function updateDocumentStatus(
  documentId: string,
  status: "processing" | "indexed" | "failed",
  message = "",
  progress = 0,
  chunkCount?: number,
): Promise<void> {
  logger.info(`Updating document status`, { documentId, status, progress, message })

  try {
    const now = new Date().toISOString()

    // Create metadata update
    const metadata: Record<string, any> = {
      status,
      processing_progress: progress,
      updated_at: now,
    }

    // Add optional fields if provided
    if (message) {
      if (status === "failed") {
        metadata.error_message = message
      } else {
        metadata.processing_message = message
      }
    }

    if (chunkCount !== undefined) {
      metadata.chunk_count = chunkCount
    }

    // Query to get the existing document metadata vector ID
    const dummyVector = new Array(3072).fill(0.001)
    const result = await queryVectors(
      dummyVector,
      1,
      true,
      {
        record_type: "document_metadata",
        document_id: documentId,
      },
      "metadata",
    )

    if (!result.matches || result.matches.length === 0) {
      throw new Error(`Document metadata not found: ${documentId}`)
    }

    const metadataId = result.matches[0].id

    // Update the document metadata in Pinecone
    await upsertVectors(
      [
        {
          id: metadataId,
          values: dummyVector,
          metadata: {
            ...result.matches[0].metadata,
            ...metadata,
          },
        },
      ],
      "metadata",
    )

    logger.info(`Document status updated successfully`, { documentId, status })
  } catch (error) {
    logger.error(`Error updating document status`, {
      documentId,
      status,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    // Don't rethrow to prevent processing pipeline from failing
  }
}

/**
 * Process a document by extracting text, creating chunks, and generating embeddings
 *
 * This function implements the document processing pipeline:
 * 1. Fetch document content from fileUrl
 * 2. Extract text based on fileType
 * 3. Split text into chunks
 * 4. Generate embeddings for each chunk
 * 5. Store chunks and embeddings in Pinecone
 * 6. Update document status to "indexed" or "failed"
 */
export async function processDocument({
  documentId,
  userId,
  filePath,
  fileName,
  fileType,
  fileUrl,
}: ProcessDocumentOptions): Promise<void> {
  logger.info(`Processing document started`, { documentId, userId, filePath, fileName, fileType })

  try {
    // Update document status to processing
    await updateDocumentStatus(documentId, "processing", "Starting document processing", 10)

    // Fetch the document content
    logger.info(`Fetching document content`, { documentId, fileUrl })
    const response = await fetch(fileUrl)

    if (!response.ok) {
      const errorMessage = `Failed to fetch document: ${response.status} ${response.statusText}`
      logger.error(errorMessage, { documentId, fileUrl })
      await updateDocumentStatus(documentId, "failed", errorMessage)
      throw new Error(errorMessage)
    }

    // Extract text based on file type
    const text = await response.text()

    // Update progress
    await updateDocumentStatus(documentId, "processing", "Document content extracted, chunking text", 30)

    // Split text into chunks
    logger.info(`Chunking document text`, { documentId, textLength: text.length })
    const MAX_CHUNK_SIZE = 1500 // Optimal size for text-embedding-3-large
    const CHUNK_OVERLAP = 150

    const chunks = chunkDocument(text, MAX_CHUNK_SIZE, CHUNK_OVERLAP)

    if (chunks.length === 0) {
      const errorMessage = "Document produced no valid chunks"
      logger.error(errorMessage, { documentId })
      await updateDocumentStatus(documentId, "failed", errorMessage)
      throw new Error(errorMessage)
    }

    logger.info(`Document chunked successfully`, { documentId, chunkCount: chunks.length })

    // Update progress
    await updateDocumentStatus(
      documentId,
      "processing",
      `Document chunked into ${chunks.length} segments, generating embeddings`,
      50,
    )

    // Process chunks in batches to avoid rate limits
    const BATCH_SIZE = 10
    const vectors = []
    let processedChunks = 0

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE)
      const batchVectors = []

      // Process each chunk in the batch
      for (let j = 0; j < batchChunks.length; j++) {
        const chunkIndex = i + j
        const chunkContent = batchChunks[j]
        const chunkId = `chunk_${documentId}_${chunkIndex}`

        try {
          // Generate embedding for the chunk
          logger.info(`Generating embedding for chunk ${chunkIndex + 1}/${chunks.length}`, { documentId })
          const embedding = await generateEmbedding(chunkContent)

          // Create chunk metadata
          const chunkMetadata: ChunkMetadata = {
            index: chunkIndex,
            document_id: documentId,
            document_name: fileName,
            document_type: fileType,
            user_id: userId,
            record_type: "chunk",
            created_at: new Date().toISOString(),
          }

          // Add vector to batch
          batchVectors.push({
            id: chunkId,
            values: embedding,
            metadata: {
              ...chunkMetadata,
              content: chunkContent,
            },
          })

          processedChunks++

          // Update progress periodically
          if (processedChunks % 10 === 0 || processedChunks === chunks.length) {
            const progress = Math.floor(50 + (processedChunks / chunks.length) * 40)
            await updateDocumentStatus(
              documentId,
              "processing",
              `Processed ${processedChunks}/${chunks.length} chunks`,
              progress,
            )
          }
        } catch (error) {
          logger.error(`Error processing chunk ${chunkIndex}`, {
            documentId,
            error: error instanceof Error ? error.message : "Unknown error",
          })
          // Continue with other chunks even if one fails
        }
      }

      // Add batch vectors to the overall vectors array
      vectors.push(...batchVectors)

      // Upsert batch to Pinecone
      if (batchVectors.length > 0) {
        try {
          logger.info(`Upserting batch of ${batchVectors.length} vectors to Pinecone`, { documentId })
          await upsertVectors(batchVectors)
        } catch (error) {
          logger.error(`Error upserting vectors to Pinecone`, {
            documentId,
            error: error instanceof Error ? error.message : "Unknown error",
          })
          // Continue with other batches even if one fails
        }
      }
    }

    // Check if we successfully processed any chunks
    if (vectors.length === 0) {
      const errorMessage = "Failed to process any document chunks"
      logger.error(errorMessage, { documentId })
      await updateDocumentStatus(documentId, "failed", errorMessage)
      throw new Error(errorMessage)
    }

    // Update document as indexed
    logger.info(`Document processing completed successfully`, {
      documentId,
      processedChunks: vectors.length,
    })

    await updateDocumentStatus(
      documentId,
      "indexed",
      `Document indexed successfully with ${vectors.length} chunks`,
      100,
      vectors.length,
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error during document processing"
    logger.error(`Document processing failed`, {
      documentId,
      error: errorMessage,
    })

    // Update document status to failed
    await updateDocumentStatus(documentId, "failed", errorMessage)

    throw error
  }
}

/**
 * Delete a document and all its chunks
 */
export async function deleteDocument(documentId: string): Promise<void> {
  logger.info(`Deleting document`, { documentId })

  try {
    // First, delete all chunks for this document
    // Create a dummy vector for querying
    const dummyVector = new Array(3072).fill(0.001)

    // Query to get all chunk IDs for this document
    const chunksResult = await queryVectors(
      dummyVector,
      10000, // High limit to get all chunks
      false, // Don't need metadata
      {
        record_type: "chunk",
        document_id: documentId,
      },
    )

    if (chunksResult.matches && chunksResult.matches.length > 0) {
      // Extract chunk IDs
      const chunkIds = chunksResult.matches.map((match) => match.id)

      // Delete chunks in batches
      const BATCH_SIZE = 100
      for (let i = 0; i < chunkIds.length; i += BATCH_SIZE) {
        const batchIds = chunkIds.slice(i, i + BATCH_SIZE)
        await deleteVectors(batchIds)
      }

      logger.info(`Deleted ${chunkIds.length} chunks for document`, { documentId })
    }

    // Now delete the document metadata
    // Query to get the document metadata ID
    const metadataResult = await queryVectors(
      dummyVector,
      1,
      false,
      {
        record_type: "document_metadata",
        document_id: documentId,
      },
      "metadata",
    )

    if (metadataResult.matches && metadataResult.matches.length > 0) {
      // Extract metadata ID
      const metadataId = metadataResult.matches[0].id

      // Delete document metadata
      await deleteVectors([metadataId], "metadata")

      logger.info(`Deleted document metadata`, { documentId, metadataId })
    }

    logger.info(`Document deleted successfully`, { documentId })
  } catch (error) {
    logger.error(`Error deleting document`, {
      documentId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    throw error
  }
}
