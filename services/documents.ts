/**
 * Document Service
 * 
 * Service for creating and managing document metadata in Pinecone.
 * Implements server-side document operations compatible with Edge runtime.
 * 
 * IMPORTANT:
 * - ALWAYS use consistent document ID format: `doc_${timestamp}_${random}`
 * - NEVER use prefixes (like 'meta_') when storing IDs in Pinecone
 * - ALWAYS use createPlaceholderVector() instead of zero vectors
 * - ALWAYS use record_type: "document" for consistent filtering
 * - Document status should be one of: "processing", "indexed", "failed"
 * 
 * Dependencies:
 * - @/lib/utils/logger for structured logging
 * - @/lib/pinecone-rest-client for vector database operations
 * - uuid for generating unique IDs
 * 
 * @module services/documents
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

  // Generate a unique document ID with timestamp for better ordering
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  const documentId = `doc_${timestamp}_${random}`
  
  // Capture current timestamp for created_at/updated_at
  const now = new Date().toISOString()

  // Create document metadata
  const document: Document = {
    id: documentId,
    user_id: userId,
    name,
    file_type: fileType,
    file_size: fileSize,
    file_path: filePath,
    status: "processing", // FIXED: Changed from "created" to "processing"
    processing_progress: 0,
    created_at: now,
    updated_at: now,
    error_message: undefined,
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
        id: documentId, // FIXED: Use consistent ID pattern with no prefix
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
