/**
 * Document Service
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
 * Designed to work with Vercel Edge functions and Pinecone Serverless.
 * 
 * Dependencies:
 * - @/lib/pinecone-rest-client for vector database operations
 * - @/lib/embedding-service for embedding generation
 * - @/lib/chunking-utils for document text processing
 * - @/lib/utils/logger for structured logging
 * 
 * @module lib/document-service
 */

import { upsertVectors, queryVectors, deleteVectors, createPlaceholderVector } from "@/lib/pinecone-rest-client"
import { generateEmbedding } from "@/lib/embedding-service"
import { chunkDocument } from "@/lib/chunking-utils"
import { EMBEDDING_MODEL } from "@/lib/embedding-config"
import { logger } from "@/lib/utils/logger"
import type { Document, ProcessDocumentOptions, ChunkMetadata } from "@/types"

// Constants
const MAX_CHUNK_SIZE = 1000 // Optimal size for embedding chunks
const CHUNK_OVERLAP = 150 // Overlap between consecutive chunks
const EMBEDDING_BATCH_SIZE = 10 // Process embeddings in small batches
const MAX_RETRIES = 3 // Maximum retries for API operations

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
    status: "processing",
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
      id: `meta_${documentId}`,
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
export async function getDocumentsByUserId(userId: string): Promise<Document[]> {
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
export async function getDocumentById(id: string): Promise<Document | null> {
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
  }
}

/**
 * Updates a document's status
 * 
 * @param documentId - Document ID
 * @param status - New status
 * @param progress - Processing progress percentage
 * @param errorMessage - Optional error message
 * @returns Updated document
 */
export async function updateDocumentStatus(
  documentId: string,
  status: "processing" | "indexed" | "failed",
  progress: number,
  errorMessage?: string,
): Promise<Document> {
  // Get current document
  const document = await getDocumentById(documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  const updatedDocument = {
    ...document,
    status,
    processing_progress: progress,
    error_message: errorMessage,
    updated_at: new Date().toISOString(),
  }

  logger.info(`Updating document status`, {
    documentId,
    status,
    progress,
    errorMessage: errorMessage ? `${errorMessage.substring(0, 100)}...` : undefined
  })

  // Create a non-zero placeholder vector
  const placeholderVector = createPlaceholderVector()

  await upsertVectors([
    {
      id: `meta_${documentId}`,
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
export async function processDocument({
  documentId,
  userId,
  filePath,
  fileName,
  fileType,
  fileUrl,
}: ProcessDocumentOptions): Promise<{
  success: boolean
  chunksProcessed: number
  vectorsInserted: number
  error?: string
}> {
  try {
    // Validate required parameters
    if (!documentId) throw new Error("documentId is required")
    if (!userId) throw new Error("userId is required")
    if (!filePath) throw new Error("filePath is required")
    if (!fileName) throw new Error("fileName is required")
    if (!fileType) throw new Error("fileType is required")
    if (!fileUrl) throw new Error("fileUrl is required")

    // Update document status to processing
    await updateDocumentStatus(documentId, "processing", 10, "Fetching document content")

    // 1. Extract text from document
    logger.info(`Processing document: Fetching content`, { documentId, fileUrl })
    
    let response;
    let retries = 0;
    
    // Implement retry logic for fetching the document
    while (retries < MAX_RETRIES) {
      try {
        response = await fetch(fileUrl, { cache: 'no-store' });
        if (response.ok) break;
        
        logger.warn(`Fetch attempt ${retries + 1} failed with status ${response.status}`, { 
          documentId, 
          fileUrl 
        });
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        retries++;
      } catch (fetchError) {
        logger.error(`Fetch attempt ${retries + 1} failed with error`, { 
          documentId, 
          error: fetchError instanceof Error ? fetchError.message : "Unknown error" 
        });
        
        if (retries >= MAX_RETRIES - 1) throw fetchError;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        retries++;
      }
    }
    
    if (!response || !response.ok) {
      const errorMessage = `Failed to fetch document: ${response?.status || 'Unknown error'} ${response?.statusText || ''}`;
      logger.error(errorMessage, { documentId, fileUrl });
      await updateDocumentStatus(documentId, "failed", 0, errorMessage);
      return { success: false, chunksProcessed: 0, vectorsInserted: 0, error: errorMessage };
    }

    const text = await response.text();

    // Validate content is not empty
    if (!text || text.trim() === "") {
      const errorMessage = "Document is empty or contains no valid text content";
      logger.error(errorMessage, { documentId, fileUrl });
      await updateDocumentStatus(documentId, "failed", 0, errorMessage);
      return { success: false, chunksProcessed: 0, vectorsInserted: 0, error: errorMessage };
    }

    logger.info(`Processing document: Content fetched successfully`, {
      documentId,
      contentLength: text.length,
    });
    await updateDocumentStatus(documentId, "processing", 30, "Chunking document content");

    // 2. Split text into chunks
    logger.info(`Processing document: Chunking content`, { documentId });
    const allChunks = chunkDocument(text, MAX_CHUNK_SIZE, CHUNK_OVERLAP);

    // Filter out non-informative chunks
    const chunks = allChunks.filter((chunk) => isInformativeChunk(chunk));

    logger.info(`Processing document: Chunking complete`, {
      documentId,
      totalChunks: allChunks.length,
      validChunks: chunks.length,
      skippedChunks: allChunks.length - chunks.length,
    });

    // Check if we have any valid chunks
    if (chunks.length === 0) {
      const errorMessage = "Document processing failed: No valid content chunks could be extracted";
      logger.error(errorMessage, { documentId, fileName });
      await updateDocumentStatus(documentId, "failed", 0, errorMessage);
      return { success: false, chunksProcessed: 0, vectorsInserted: 0, error: errorMessage };
    }

    await updateDocumentStatus(
      documentId,
      "processing",
      40,
      `Generating embeddings for ${chunks.length} chunks using ${EMBEDDING_MODEL}`
    );

    // 3. Generate embeddings and store in Pinecone
    const UPSERT_BATCH_SIZE = 100;
    let successfulEmbeddings = 0;
    let failedEmbeddings = 0;
    let totalVectorsInserted = 0;

    // Process chunks in batches for embedding generation
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchProgress = Math.floor(40 + (i / chunks.length) * 50);

      await updateDocumentStatus(
        documentId,
        "processing",
        batchProgress,
        `Processing batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)}`
      );

      logger.info(`Processing document: Generating embeddings for batch`, {
        documentId,
        batchNumber: Math.floor(i / EMBEDDING_BATCH_SIZE) + 1,
        batchSize: batch.length,
        progress: `${batchProgress}%`,
      });

      // Generate embeddings for this batch
      const embeddingPromises = batch.map(async (chunk, index) => {
        try {
          // Skip empty or whitespace-only chunks
          if (!chunk || chunk.trim() === "") {
            logger.info("Skipping empty chunk", { documentId, chunkIndex: i + index });
            failedEmbeddings++;
            return null;
          }

          const embedding = await generateEmbedding(chunk);

          // Validate embedding is not all zeros
          if (embedding.every((v) => v === 0)) {
            logger.error("Skipping zero-vector embedding", {
              documentId,
              chunkIndex: i + index,
              chunkSample: chunk.substring(0, 50) + "...",
            });
            failedEmbeddings++;
            return null;
          }

          successfulEmbeddings++;
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
            },
          };
        } catch (error) {
          logger.error(`Error generating embedding for chunk:`, {
            documentId,
            chunkIndex: i + index,
            error: error instanceof Error ? error.message : "Unknown error",
            chunkSample: chunk.substring(0, 100) + "...",
          });
          failedEmbeddings++;
          return null;
        }
      });

      try {
        const embeddingResults = await Promise.all(embeddingPromises);

        // Filter out null results (failed embeddings)
        const embeddings = embeddingResults.filter((result) => result !== null) as any[];

        if (embeddings.length > 0) {
          // Store embeddings in Pinecone in batches of UPSERT_BATCH_SIZE
          for (let j = 0; j < embeddings.length; j += UPSERT_BATCH_SIZE) {
            const upsertBatch = embeddings.slice(j, j + UPSERT_BATCH_SIZE);

            logger.info(`Processing document: Upserting vectors to Pinecone`, {
              documentId,
              batchNumber: Math.floor(i / EMBEDDING_BATCH_SIZE) + 1,
              upsertBatchNumber: Math.floor(j / UPSERT_BATCH_SIZE) + 1,
              vectorCount: upsertBatch.length,
            });

            try {
              const upsertResult = await upsertVectors(upsertBatch);
              totalVectorsInserted += upsertResult.upsertedCount || upsertBatch.length;

              logger.info(`Processing document: Vectors upserted successfully`, {
                documentId,
                batchNumber: Math.floor(i / EMBEDDING_BATCH_SIZE) + 1,
                upsertBatchNumber: Math.floor(j / UPSERT_BATCH_SIZE) + 1,
                vectorsInserted: upsertResult.upsertedCount || upsertBatch.length,
              });
            } catch (upsertError) {
              logger.error(`Error upserting vectors to Pinecone`, {
                documentId,
                batchNumber: Math.floor(i / EMBEDDING_BATCH_SIZE) + 1,
                upsertBatchNumber: Math.floor(j / UPSERT_BATCH_SIZE) + 1,
                error: upsertError instanceof Error ? upsertError.message : "Unknown error",
              });
              failedEmbeddings += upsertBatch.length;
            }
          }
        } else {
          logger.warn(`Processing document: No valid embeddings in batch`, {
            documentId,
            batchNumber: Math.floor(i / EMBEDDING_BATCH_SIZE) + 1,
          });
        }
      } catch (batchError) {
        logger.error(`Error processing embedding batch`, {
          documentId,
          batchNumber: Math.floor(i / EMBEDDING_BATCH_SIZE) + 1,
          error: batchError instanceof Error ? batchError.message : "Unknown error",
        });
        // Continue with the next batch even if this one failed
      }
    }

    // 4. Update document status based on embedding results
    if (successfulEmbeddings === 0) {
      const errorMessage = `Document processing failed: Could not generate any valid embeddings from ${chunks.length} chunks`;
      logger.error(errorMessage, { documentId });
      await updateDocumentStatus(documentId, "failed", 0, errorMessage);
      return {
        success: false,
        chunksProcessed: chunks.length,
        vectorsInserted: 0,
        error: errorMessage,
      };
    }

    // Also update document with chunk count metadata
    const placeholderVector = createPlaceholderVector();
    await upsertVectors([
      {
        id: `meta_${documentId}`,
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
        },
      },
    ]);

    logger.info(`Processing document: Complete`, {
      documentId,
      totalChunks: chunks.length,
      successfulEmbeddings,
      failedEmbeddings,
      totalVectorsInserted,
    });

    return {
      success: true,
      chunksProcessed: chunks.length,
      vectorsInserted: totalVectorsInserted,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    logger.error("Error processing document:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      documentId,
    });

    // Update document status to failed
    try {
      await updateDocumentStatus(documentId, "failed", 0, errorMessage);
    } catch (statusError) {
      logger.error("Failed to update document status after error:", statusError);
    }

    return {
      success: false,
      chunksProcessed: 0,
      vectorsInserted: 0,
      error: errorMessage,
    };
  }
}

/**
 * Deletes a document and all its chunks
 * 
 * @param id - Document ID
 */
export async function deleteDocument(id: string): Promise<void> {
  // Delete the document
  await deleteVectors([`meta_${id}`]);

  // Create a placeholder vector with small non-zero values
  const placeholderVector = createPlaceholderVector();

  // Find all chunks for this document
  const response = await queryVectors(
    placeholderVector,
    1000,
    true,
    {
      document_id: { $eq: id },
      record_type: { $eq: "chunk" },
    },
  );

  // Delete all chunks
  if (response.matches && response.matches.length > 0) {
    const chunkIds = response.matches.map((match) => match.id);
    await deleteVectors(chunkIds);
  }
}

/**
 * Validates if a chunk is informative enough to be embedded
 * 
 * @param text - Chunk text content
 * @returns True if chunk is informative
 */
function isInformativeChunk(text: string): boolean {
  if (!text || text.trim() === "") {
    return false;
  }

  // Skip chunks that are too short
  if (text.trim().length < 10) {
    return false;
  }

  // Skip chunks that don't have enough unique words
  const uniqueWords = new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 1),
  );

  if (uniqueWords.size < 3) {
    return false;
  }

  return true;
}
