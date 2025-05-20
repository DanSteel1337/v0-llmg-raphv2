/**
 * Documents Hook
 *
 * Custom hook for managing document operations.
 * Provides functionality for fetching, uploading, deleting, and processing documents.
 *
 * Features:
 * - Document listing and filtering
 * - Document upload with progress tracking
 * - Document deletion
 * - Processing retry for failed documents
 * - Automatic refresh of document list
 *
 * Dependencies:
 * - @/services/client-api-service for backend communication
 * - @/types for document type definitions
 *
 * @module hooks/use-documents
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import {
  fetchDocuments as apiFetchDocuments,
  uploadDocument as apiUploadDocument,
  deleteDocument as apiDeleteDocument,
  retryDocumentProcessing,
} from "@/services/client-api-service"
import type { Document } from "@/types"
import { useToastAdapter } from "@/components/toast-adapter"

/**
 * Hook for document management functionality
 * @param userId User ID for the current user
 * @returns Document state and methods
 */
export function useDocuments(userId?: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToastAdapter()

  /**
   * Fetch documents from the API
   */
  const fetchDocuments = useCallback(async () => {
    if (!userId) {
      setDocuments([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const docs = await apiFetchDocuments(userId)
      setDocuments(docs)
    } catch (err) {
      console.error("Error fetching documents:", err)
      setError(err instanceof Error ? err.message : "Failed to load documents")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  /**
   * Upload a document
   * @param file File to upload
   * @returns Uploaded document
   */
  const uploadDocument = useCallback(
    async (file: File): Promise<Document> => {
      if (!userId) {
        throw new Error("User ID is required to upload a document")
      }

      try {
        const document = await apiUploadDocument(userId, file)
        await fetchDocuments() // Refresh the document list
        return document
      } catch (error) {
        console.error("Error uploading document:", error)
        throw error
      }
    },
    [userId, fetchDocuments],
  )

  /**
   * Delete a document
   * @param documentId Document ID to delete
   */
  const deleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await apiDeleteDocument(documentId)
        await fetchDocuments() // Refresh the document list
      } catch (error) {
        console.error("Error deleting document:", error)
        throw error
      }
    },
    [fetchDocuments],
  )

  /**
   * Retry processing a failed document
   * @param documentId Document ID to retry
   */
  const retryProcessing = useCallback(
    async (documentId: string) => {
      try {
        await retryDocumentProcessing(documentId)
        await fetchDocuments() // Refresh the document list
      } catch (error) {
        console.error("Error retrying document processing:", error)
        throw error
      }
    },
    [fetchDocuments],
  )

  // Initial fetch on mount
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  return {
    documents,
    isLoading,
    error,
    uploadDocument,
    deleteDocument,
    retryProcessing,
    refreshDocuments: fetchDocuments,
  }
}
