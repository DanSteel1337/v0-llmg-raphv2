/**
 * Document service for creating and managing documents
 */

import { v4 as uuidv4 } from "uuid"
import { logger } from "@/lib/utils/logger"
import { upsertVectors } from "@/lib/pinecone-rest-client"
import type { Document } from "@/types"

/**
 * Creates a new document and persists its metadata
 * @param params - Document creation parameters
 * @returns The created document
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

  // Create document metadata
  const document: Document = {
    id: documentId,
    user_id: userId,
    name,
    file_type: fileType,
    file_size: fileSize,
    file_path: filePath,
    status: "created",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    chunk_count: 0,
    embedding_model: "text-embedding-3-large",
  }

  // Persist document metadata to Pinecone
  try {
    await upsertVectors([
      {
        id: documentId,
        values: new Array(3072).fill(0.001), // Placeholder vector
        metadata: {
          ...document,
          type: "document",
        },
      },
    ])

    logger.info("Document created successfully", { documentId })
    return document
  } catch (error) {
    logger.error("Failed to create document", { error, documentId })
    throw new Error(`Failed to create document: ${error instanceof Error ? error.message : String(error)}`)
  }
}
