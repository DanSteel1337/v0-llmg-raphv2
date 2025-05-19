/**
 * Document Service
 *
 * Handles document operations including creation, retrieval, and processing.
 */

import { upsertVectors, queryVectors } from "@/lib/pinecone-rest-client"
import type { Document } from "@/types"

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
  const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

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
    status: "pending",
    processing_progress: 0,
    processing_message: "Document created, waiting for processing",
    chunk_count: 0,
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
          values: new Array(1536).fill(0.001), // Small non-zero vector for metadata
          metadata: {
            record_type: "document_metadata",
            document_id: id,
            user_id: userId,
            name,
            description: description || "",
            file_type: fileType || "",
            file_size: fileSize || 0,
            file_path: filePath || "",
            status: "pending",
            processing_progress: 0,
            processing_message: "Document created, waiting for processing",
            chunk_count: 0,
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
    const dummyVector = new Array(1536).fill(0.001)

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
          status: metadata.status || "pending",
          processing_progress: metadata.processing_progress || 0,
          processing_message: metadata.processing_message || "",
          chunk_count: metadata.chunk_count || 0,
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

// ... rest of the file remains unchanged
