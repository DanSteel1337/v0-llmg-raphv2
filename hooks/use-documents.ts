/**
 * Use Documents Hook
 *
 * Custom hook for managing document operations including fetching,
 * uploading, and deleting documents.
 *
 * Dependencies:
 * - @/hooks/use-api for API interaction
 * - @/services/client-api-service for document operations
 */

"use client"

import { useEffect, useCallback, useState } from "react"
import { fetchDocuments, uploadDocument as apiUploadDocument, deleteDocument as apiDeleteDocument } from "@/services/client-api-service"
import type { Document } from "@/types"

/**
 * Hook for document management operations
 * 
 * @param userId The user ID for documents context
 * @returns Document operations and state
 */
export function useDocuments(userId: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Fetch documents from the API and update state
   */
  const fetchDocumentsData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const docs = await fetchDocuments(userId)
      setDocuments(docs)
    } catch (err) {
      console.error("Error fetching documents:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Load documents on mount
  useEffect(() => {
    fetchDocumentsData()
  }, [fetchDocumentsData])

  /**
   * Upload a document and optionally monitor progress
   * 
   * @param file The file to upload
   * @param onProgress Optional progress callback
   * @returns Document metadata from the server
   */
  const handleUploadDocument = async (file: File, onProgress?: (progress: number) => void) => {
    try {
      setError(null)
      
      // Call the API service to upload the document
      const document = await apiUploadDocument(userId, file, onProgress)

      // Refresh the documents list to include the newly uploaded document
      fetchDocumentsData()

      return document
    } catch (err) {
      console.error("Error uploading document:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }

  /**
   * Delete a document by ID
   * 
   * @param id Document ID to delete
   */
  const handleDeleteDocument = async (id: string) => {
    try {
      setError(null)
      
      // Call the API service to delete the document
      await apiDeleteDocument(id)

      // Update the local state to remove the deleted document
      setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== id))
    } catch (err) {
      console.error("Error deleting document:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }

  return {
    documents,
    isLoading,
    error,
    uploadDocument: handleUploadDocument,
    deleteDocument: handleDeleteDocument,
    refreshDocuments: fetchDocumentsData,
  }
}
