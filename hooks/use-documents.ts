/**
 * Document Management Hook
 *
 * React hook for managing documents in the Vector RAG application.
 * Provides functionality for fetching, uploading, deleting, and retrying document processing.
 *
 * Features:
 * - Document listing with automatic updating
 * - Document upload with progress tracking
 * - Document deletion with error handling
 * - Processing retry for failed documents
 *
 * Dependencies:
 * - @/services/client-api-service for API interactions
 * - @/hooks/use-auth for user session information
 * - @/types for document interfaces
 *
 * @module hooks/use-documents
 */

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "./use-auth"
import { fetchDocuments, uploadDocument as apiUploadDocument, deleteDocument as apiDeleteDocument, retryDocumentProcessing } from "@/services/client-api-service"
import type { Document } from "@/types"

/**
 * Hook for document management functionality
 * @returns Document management methods and state
 */
export function useDocuments() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Keep track of active polling intervals to properly clean them up
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch documents on mount and when user changes
  useEffect(() => {
    if (!user?.id) {
      setDocuments([])
      setIsLoading(false)
      return
    }

    const loadDocuments = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const docs = await fetchDocuments(user.id)
        setDocuments(docs)
      } catch (err) {
        console.error("Error fetching documents:", err)
        setError(err instanceof Error ? err.message : "Failed to load documents")
      } finally {
        setIsLoading(false)
      }
    }

    loadDocuments()
  }, [user?.id])

  // Poll for document updates when there are processing documents
  useEffect(() => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    // Only poll if we have documents that are processing
    if (!user?.id || !documents.some((doc) => doc.status === "processing")) {
      return
    }

    // Poll every 5 seconds for updates on processing documents
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const updatedDocs = await fetchDocuments(user.id)
        setDocuments((prevDocs) => {
          // Create a map of existing documents
          const docMap = new Map(prevDocs.map((doc) => [doc.id, doc]))
          
          // Update with latest data
          for (const updatedDoc of updatedDocs) {
            docMap.set(updatedDoc.id, updatedDoc)
          }
          
          return Array.from(docMap.values())
        })
      } catch (err) {
        console.error("Error polling documents:", err)
        // Don't update error state to avoid UI disruption during polling
      }
    }, 5000)

    // Clean up interval on unmount or when documents change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [documents, user?.id])

  /**
   * Upload a document with progress tracking
   * @param file File to upload
   * @param onProgress Optional progress callback function
   * @returns The created document
   */
  const handleUploadDocument = useCallback(
    async (file: File, onProgress?: ((progress: number) => void) | undefined) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        const newDocument = await apiUploadDocument(user.id, file, onProgress)

        // Add the new document to the state
        setDocuments((prevDocs) => [newDocument, ...prevDocs])

        return newDocument
      } catch (err) {
        console.error("Error uploading document:", err)
        throw err
      }
    },
    [user?.id]
  )

  /**
   * Delete a document by ID
   * @param documentId Document ID to delete
   * @returns True if deletion was successful
   */
  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        await apiDeleteDocument(documentId)

        // Remove the deleted document from the state
        setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== documentId))

        return true
      } catch (err) {
        console.error("Error deleting document:", err)
        throw err
      }
    },
    [user?.id]
  )

  /**
   * Retry processing a failed document
   * @param documentId Document ID to retry processing for
   * @returns True if retry was successful
   */
  const handleRetryProcessing = useCallback(
    async (documentId: string) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        await retryDocumentProcessing(documentId)

        // Update the document status in the state
        setDocuments((prevDocs) =>
          prevDocs.map((doc) =>
            doc.id === documentId
              ? { ...doc, status: "processing", processing_progress: 0, error_message: undefined }
              : doc
          )
        )

        return true
      } catch (err) {
        console.error("Error retrying document processing:", err)
        throw err
      }
    },
    [user?.id]
  )

  /**
   * Refresh documents from the API
   * @returns The fetched documents
   */
  const handleRefreshDocuments = useCallback(async () => {
    if (!user?.id) {
      return []
    }

    try {
      const docs = await fetchDocuments(user.id)
      setDocuments(docs)
      return docs
    } catch (err) {
      console.error("Error refreshing documents:", err)
      throw err
    }
  }, [user?.id])

  return {
    documents,
    isLoading,
    error,
    uploadDocument: handleUploadDocument,
    deleteDocument: handleDeleteDocument,
    retryProcessing: handleRetryProcessing,
    refreshDocuments: handleRefreshDocuments,
  }
}
