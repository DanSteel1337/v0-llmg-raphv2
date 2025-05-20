/**
 * Document service for creating and managing documents
 * 
 * This service handles document metadata creation and persistence in Pinecone.
 * It implements server-side document operations compatible with Edge runtime.
 * 
 * Dependencies:
 * - @/lib/utils/logger for consistent logging
 * - @/lib/pinecone-rest-client for Pinecone vector operations
 * - uuid for generating unique IDs
 */

import { v4 as uuidv4 } from "uuid"
import { logger } from "@/lib/utils/logger"
import { upsertVectors, createPlaceholderVector } from "@/lib/pinecone-rest-client"
import type { Document } from "@/types"

/**
 * Creates a new document and persists its metadata to Pinecone
 * Uses a consistent placeholder vector that meets Pinecone's requirements
 * 
 * @param params - Document creation parameters including metadata
 * @returns The created document with full metadata
 */
export const createDocument = async (params: {
  userId: string
  name: string
  fileType: string
  fileSize: number
  filePath: string
}): Promise<Document> => {
  const { userId, name, fileType, fileSize, filePath } = params

  // Generate a unique document ID
  const documentId = `doc_${uuidv4()}`
  
  // Capture current timestamp for created_at/updated_at
  const timestamp = new Date().toISOString()

  // Create document metadata
  const document: Document = {
    id: documentId,
    user_id: userId,
    name,
    file_type: fileType,
    file_size: fileSize,
    file_path: filePath,
    status: "created",
    created_at: timestamp,
    updated_at: timestamp,
    chunk_count: 0,
    embedding_model: "text-embedding-3-large",
  }

  logger.info("Creating new document", { 
    documentId, 
    userId,
    fileName: name,
    fileType,
    fileSize
  })

  // Persist document metadata to Pinecone
  try {
    // Use createPlaceholderVector to ensure a valid non-zero vector
    const placeholderVector = createPlaceholderVector()
    
    await upsertVectors([
      {
        id: documentId,
        values: placeholderVector, // Proper placeholder vector with non-zero values
        metadata: {
          ...document,
          record_type: "document", // Use consistent record_type field name
        },
      },
    ])

    logger.info("Document created successfully", { 
      documentId, 
      name,
      userId
    })
    
    return document
  } catch (error) {
    // Log detailed error information for debugging
    logger.error("Failed to create document", { 
      error: error instanceof Error ? error.message : String(error),
      documentId,
      name,
      userId,
      stackTrace: error instanceof Error ? error.stack : undefined
    })
    
    throw new Error(`Failed to create document: ${error instanceof Error ? error.message : String(error)}`)
  }
}
