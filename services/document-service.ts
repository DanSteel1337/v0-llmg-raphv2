/**
 * Document Service
 *
 * Handles document functionality including:
 * - Document management (create, read, update, delete)
 * - Document processing and chunking
 * - Vector storage for document chunks
 *
 * Dependencies:
 * - @/lib/pinecone-rest-client.ts for vector storage and retrieval
 * - @/lib/embedding-service.ts for embeddings
 * - @/lib/chunking-utils.ts for document chunking
 * - uuid for ID generation
 */

import { v4 as uuidv4 } from "uuid"
import { upsertVectors, queryVectors, deleteVectors } from "@/lib/pinecone-rest-client"
import { generateEmbedding } from "@/lib/embedding-service"
import { chunkDocument } from "@/lib/chunking-utils"
import { getEmbeddingConfig } from "@/lib/embedding-config"
import type { Document, ProcessDocumentOptions } from "@/types"

// Constants
const MAX_CHUNK_SIZE = 1000
const { dimensions } = getEmbeddingConfig()

/**
 * Creates a new document
 */
export async function createDocument(
  userId: string,
  name: string,
  description?: string,
  fileType?: string,
  fileSize?: number,
  filePath?: string,
): Promise<Document> {
  const documentId = uuidv4()
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

  // Create a zero vector with the correct dimension
  const zeroVector = new Array(dimensions).fill(0)

  await upsertVectors([
    {
      id: documentId,
      values: zeroVector, // Zero vector with correct dimension
      metadata: {
        ...document,
        record_type: "document",
      },
    },
  ])

  return document
}

/**
 * Gets all documents for a user
 */
export async function getDocumentsByUserId(userId: string): Promise<Document[]> {
  try {
    console.log(`getDocumentsByUserId: Fetching documents for user ${userId}`)

    // Create a zero vector with the correct dimension
    const zeroVector = new Array(dimensions).fill(0)

    const response = await queryVectors(
      zeroVector, // Zero vector with correct dimension
      100,
      true,
      {
        user_id: { $eq: userId },
        record_type: { $eq: "document" },
      },
    )

    // Handle potential error from Pinecone
    if ("error" in response && response.error) {
      console.error("Error querying documents from Pinecone:", response)
      return [] // Return empty array as fallback
    }

    const documents = (response.matches || []).map((match) => ({
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

    console.log(`getDocumentsByUserId: Successfully fetched ${documents.length} documents for user ${userId}`)
    return documents
  } catch (error) {
    console.error(`getDocumentsByUserId: Error fetching documents for user ${userId}:`, error)
    throw error
  }
}

/**
 * Gets document count for a user
 */
export async function getDocumentCountByUserId(userId: string): Promise<number> {
  try {
    // Create a zero vector with the correct dimension
    const zeroVector = new Array(dimensions).fill(0)

    // Query Pinecone for documents with the specified user_id
    const response = await queryVectors(
      zeroVector,
      10000, // Use a high limit, but be aware of potential truncation
      true,
      {
        user_id: { $eq: userId },
        record_type: { $eq: "document" },
      },
    )

    // Handle potential error from Pinecone
    if ("error" in response && response.error) {
      console.error("Error getting document count from Pinecone:", response)
      return 0 // Return 0 as fallback
    }

    return response.matches?.length || 0
  } catch (error) {
    console.error("Error getting document count:", error)
    return 0
  }
}

/**
 * Gets a document by ID
 */
export async function getDocumentById(id: string): Promise<Document | null> {
  // Create a zero vector with the correct dimension
  const zeroVector = new Array(dimensions).fill(0)

  const response = await queryVectors(
    zeroVector, // Zero vector with correct dimension
    1,
    true,
    {
      id: { $eq: id },
      record_type: { $eq: "document" },
    },
  )

  // Handle potential error from Pinecone
  if ("error" in response && response.error) {
    console.error("Error querying document from Pinecone:", response)
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
    error_message: errorMessage || "",
    updated_at: new Date().toISOString(),
  }

  // Create a zero vector with the correct dimension
  const zeroVector = new Array(dimensions).fill(0)

  await upsertVectors([
    {
      id: documentId,
      values: zeroVector, // Zero vector with correct dimension
      metadata: {
        ...updatedDocument,
        record_type: "document",
      },
    },
  ])

  return updatedDocument
}

/**
 * Deletes a document and all its chunks
 */
export async function deleteDocument(id: string): Promise<void> {
  // Delete the document
  await deleteVectors([id])

  // Create a zero vector with the correct dimension
  const zeroVector = new Array(dimensions).fill(0)

  // Find all chunks for this document
  const response = await queryVectors(
    zeroVector, // Zero vector with correct dimension
    1000,
    true,
    {
      document_id: { $eq: id },
      record_type: { $eq: "chunk" },
    },
  )

  // Delete all chunks
  if (response.matches && response.matches.length > 0) {
    const chunkIds = response.matches.map((match) => match.id)
    await deleteVectors(chunkIds)
  }
}

/**
 * Uploads a file to storage (using Supabase for file storage only)
 */
export async function uploadFile(userId: string, file: File): Promise<{ path: string }> {
  // In a real implementation, you would upload the file to a storage service
  // For this example, we'll simulate a successful upload
  const fileName = `${Date.now()}-${file.name}`
  const filePath = `${userId}/${fileName}`

  return { path: filePath }
}

/**
 * Gets a signed URL for a file
 */
export async function getFileSignedUrl(filePath: string): Promise<string> {
  // In a real implementation, you would generate a signed URL from your storage service
  // For this example, we'll return a placeholder URL
  return `https://example.com/files/${filePath}`
}

/**
 * Validates if a chunk is informative enough to be embedded
 */
function isInformativeChunk(text: string): boolean {
  if (!text || text.trim() === "") {
    return false
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
 * Processes a document: extracts text, chunks it, and stores embeddings
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
    // Update document status to processing
    await updateDocumentStatus(documentId, "processing", 10, "Fetching document content")

    // 1. Extract text from document
    console.log(`Processing document: Fetching content`, { documentId, fileUrl })
    const response = await fetch(fileUrl)
    if (!response.ok) {
      const errorMessage = `Failed to fetch document: ${response.status} ${response.statusText}`
      console.error(errorMessage, { documentId, fileUrl })
      return { success: false, chunksProcessed: 0, vectorsInserted: 0, error: errorMessage }
    }

    const text = await response.text()
    console.log(`Processing document: Content fetched successfully`, {
      documentId,
      contentLength: text.length,
    })
    await updateDocumentStatus(documentId, "processing", 30, "Chunking document content")

    // 2. Split text into chunks
    console.log(`Processing document: Chunking content`, { documentId })
    const allChunks = chunkDocument(text, MAX_CHUNK_SIZE)

    // Filter out non-informative chunks
    const chunks = allChunks.filter((chunk) => isInformativeChunk(chunk))

    console.log(`Processing document: Chunking complete`, {
      documentId,
      totalChunks: allChunks.length,
      validChunks: chunks.length,
      skippedChunks: allChunks.length - chunks.length,
    })

    // Check if we have any valid chunks
    if (chunks.length === 0) {
      const errorMessage = "Document processing failed: No valid content chunks could be extracted"
      console.error(errorMessage, { documentId, fileName })
      return { success: false, chunksProcessed: 0, vectorsInserted: 0, error: errorMessage }
    }

    await updateDocumentStatus(documentId, "processing", 40, `Generating embeddings for ${chunks.length} chunks`)

    // 3. Generate embeddings and store in Pinecone
    const BATCH_SIZE = 20
    let successfulEmbeddings = 0
    let failedEmbeddings = 0
    let totalVectorsInserted = 0

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const batchProgress = Math.floor(40 + (i / chunks.length) * 50)

      await updateDocumentStatus(
        documentId,
        "processing",
        batchProgress,
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`,
      )

      console.log(`Processing document: Generating embeddings for batch`, {
        documentId,
        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
        batchSize: batch.length,
        progress: `${batchProgress}%`,
      })

      // Generate embeddings for this batch
      const embeddingPromises = batch.map(async (chunk, index) => {
        try {
          // Skip empty or whitespace-only chunks
          if (!chunk || chunk.trim() === "") {
            console.log("Skipping empty chunk", { documentId, chunkIndex: i + index })
            failedEmbeddings++
            return null
          }

          const embedding = await generateEmbedding(chunk)

          // Validate embedding is not all zeros
          if (embedding.every((v) => v === 0)) {
            console.error("Skipping zero-vector embedding", {
              documentId,
              chunkIndex: i + index,
              chunkSample: chunk.substring(0, 50) + "...",
            })
            failedEmbeddings++
            return null
          }

          successfulEmbeddings++
          return {
            id: uuidv4(),
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
          }
        } catch (error) {
          console.error(`Error generating embedding for chunk:`, {
            documentId,
            chunkIndex: i + index,
            error: error instanceof Error ? error.message : "Unknown error",
            chunkSample: chunk.substring(0, 100) + "...",
          })
          failedEmbeddings++
          return null
        }
      })

      const embeddingResults = await Promise.all(embeddingPromises)

      // Filter out null results (failed embeddings)
      const embeddings = embeddingResults.filter((result) => result !== null) as any[]

      if (embeddings.length > 0) {
        // Store embeddings in Pinecone
        console.log(`Processing document: Upserting vectors to Pinecone`, {
          documentId,
          batchNumber: Math.floor(i / BATCH_SIZE) + 1,
          vectorCount: embeddings.length,
        })

        try {
          const upsertResult = await upsertVectors(embeddings)
          totalVectorsInserted += embeddings.length

          console.log(`Processing document: Vectors upserted successfully`, {
            documentId,
            batchNumber: Math.floor(i / BATCH_SIZE) + 1,
            vectorsInserted: embeddings.length,
            upsertResult,
          })
        } catch (upsertError) {
          console.error(`Error upserting vectors to Pinecone`, {
            documentId,
            batchNumber: Math.floor(i / BATCH_SIZE) + 1,
            error: upsertError instanceof Error ? upsertError.message : "Unknown error",
          })
          failedEmbeddings += embeddings.length
        }
      } else {
        console.warn(`Processing document: No valid embeddings in batch`, {
          documentId,
          batchNumber: Math.floor(i / BATCH_SIZE) + 1,
        })
      }
    }

    // 4. Update document status based on embedding results
    if (successfulEmbeddings === 0) {
      const errorMessage = `Document processing failed: Could not generate any valid embeddings from ${chunks.length} chunks`
      console.error(errorMessage, { documentId })
      return {
        success: false,
        chunksProcessed: chunks.length,
        vectorsInserted: 0,
        error: errorMessage,
      }
    }

    console.log(`Processing document: Complete`, {
      documentId,
      totalChunks: chunks.length,
      successfulEmbeddings,
      failedEmbeddings,
      totalVectorsInserted,
    })

    return {
      success: true,
      chunksProcessed: chunks.length,
      vectorsInserted: totalVectorsInserted,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    console.error("Error processing document:", error, { documentId })
    return {
      success: false,
      chunksProcessed: 0,
      vectorsInserted: 0,
      error: errorMessage,
    }
  }
}
