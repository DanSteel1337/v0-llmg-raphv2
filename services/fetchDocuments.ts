/**
 * Fetch Documents Service
 *
 * Service for fetching documents from the API.
 *
 * EXPORTS:
 * ---------
 * - fetchDocuments: Fetches all documents for a user
 */

import { apiCall } from "./apiCall"

/**
 * Fetch documents for a user
 */
export async function fetchDocuments(userId: string): Promise<Document[]> {
  try {
    const response = await apiCall<Document[] | null>(`/api/documents?userId=${userId}`)
    return response || []
  } catch (error) {
    console.error("Error fetching documents:", error)
    return []
  }
}

// Type definition for Document
interface Document {
  id: string
  name: string
  file_path: string
  status?: string
  processing_progress?: number
  [key: string]: any
}
