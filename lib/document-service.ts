/**
 * Document Service
 *
 * Handles document operations including creation, retrieval, and processing.
 */

import { upsertVectors } from "@/lib/pinecone-rest-client"
import type { Document } from "@/types"
import { isValidDocument } from "@/lib/utils/validators"

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
  providedId?: string,
): Promise<Document> {
  console.log(`Creating document record`, { userId, name })

  // Generate a unique ID for the document, with fallback
  const id = providedId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

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
  if (!document.id) {
    console.error("Failed to generate document ID", { document })
    throw new Error("Failed to generate document ID")
  }

  // Store document metadata in Pinecone
  try {
    await upsertVectors(
      [
        {
          id: `meta_${id}`,
          values: new Array(1536).fill(0), // Zero vector for metadata
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

    // Final validation before returning
    if (!isValidDocument(document)) {
      console.error("Document validation failed after creation", { document })
      throw new Error("Document validation failed after creation")
    }

    return document
  } catch (error) {
    console.error(`Error storing document metadata in Pinecone`, {
      documentId: id,
      error: error instanceof Error ? error.message : "Unknown error",
      document,
    })
    throw error
  }
}

// ... rest of the file remains unchanged
