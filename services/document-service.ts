/**
 * Document Service
 *
 * Client-side service for document operations.
 */

import { handleApiRequest } from "@/utils/apiRequest"
import type { Document } from "@/types"

/**
 * Fetch a document by ID
 */
export async function fetchDocumentById(id: string): Promise<Document | null> {
  try {
    return await handleApiRequest<Document>(`/api/documents/${id}`, {
      method: "GET",
    })
  } catch (error) {
    console.error(`Failed to fetch document by ID: ${id}`, error)
    return null
  }
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  id: string,
  status: "processing" | "indexed" | "failed",
  progress = 0,
  message = "",
): Promise<Document> {
  return handleApiRequest<Document>(`/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      processing_progress: progress,
      error_message: status === "failed" ? message : undefined,
      updated_at: new Date().toISOString(),
    }),
  })
}
