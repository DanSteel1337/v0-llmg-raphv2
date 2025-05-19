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
import { VECTOR_DIMENSION } from "@/lib/embedding-config"
import type { Document, ProcessDocumentOptions } from "@/types"

// Constants
const MAX_CHUNK_SIZE = 1000

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
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

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
  // Create a zero vector with the correct dimension
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

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

  return (response.matches || []).map((match) => ({
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
}

/**
 * Gets a document by ID
 */
export async function getDocumentById(id: string): Promise<Document | null> {
  // Create a zero vector with the correct dimension
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

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
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

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
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

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
 * Processes a document: extracts text, chunks it, and stores embeddings
 */
export async function processDocument({
  documentId,
  userId,
  filePath,
  fileName,
  fileType,
  fileUrl,
}: ProcessDocumentOptions): Promise<boolean> {
  try {
    // Update document status to processing
    await updateDocumentStatus(documentId, "processing", 10)

    // 1. Extract text from document
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`)
    }
    const text = await response.text()
    await updateDocumentStatus(documentId, "processing", 30)

    // 2. Split text into chunks
    const chunks = chunkDocument(text, MAX_CHUNK_SIZE)

    // Check if we have any valid chunks
    if (chunks.length === 0) {
      console.error("No valid chunks extracted from document", { documentId, fileName })
      await updateDocumentStatus(
        documentId,
        "failed",
        0,
        "Document processing failed: No valid content chunks could be extracted",
      )
      return false
    }

    console.log(`Extracted ${chunks.length} valid chunks from document`, { documentId, fileName })
    await updateDocumentStatus(documentId, "processing", 50)

    // 3. Generate embeddings and store in Pinecone
    const BATCH_SIZE = 20
    let successfulEmbeddings = 0
    let failedEmbeddings = 0

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)

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
        await upsertVectors(embeddings)
      }

      // Update progress
      const progress = Math.min(50 + Math.floor(((i + batch.length) / chunks.length) * 40), 90)
      await updateDocumentStatus(documentId, "processing", progress)
    }

    // 4. Update document status based on embedding results
    if (successfulEmbeddings === 0) {
      await updateDocumentStatus(
        documentId,
        "failed",
        0,
        `Document processing failed: Could not generate any valid embeddings from ${chunks.length} chunks`,
      )
      return false
    } else if (failedEmbeddings > 0) {
      // Partial success
      await updateDocumentStatus(
        documentId,
        "indexed",
        100,
        `Document indexed with warnings: ${successfulEmbeddings} chunks processed successfully, ${failedEmbeddings} chunks skipped`,
      )
    } else {
      // Complete success
      await updateDocumentStatus(documentId, "indexed", 100)
    }

    return true
  } catch (error) {
    console.error("Error processing document:", error)
    await updateDocumentStatus(
      documentId,
      "failed",
      0,
      error instanceof Error ? error.message : "Unknown error occurred",
    )
    return false
  }
}
