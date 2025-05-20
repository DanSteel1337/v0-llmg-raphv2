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

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./use-auth"
import { fetchDocuments, uploadDocument, deleteDocument, retryDocumentProcessing } from "@/services/client-api-service"
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

  // Add a polling mechanism to check document status:
  useEffect(() => {
    // Only poll if we have documents that are processing
    if (!documents.some((doc) => doc.status === "processing")) {
      return
    }

    // Poll every 5 seconds for updates on processing documents
    const interval = setInterval(async () => {
      try {
        if (user?.id) {
          const updatedDocs = await fetchDocuments(user.id)
          setDocuments((prevDocs) => {
            // Merge the updated docs with existing ones, prioritizing updates for processing docs
            const docMap = new Map(prevDocs.map((doc) => [doc.id, doc]))

            for (const updatedDoc of updatedDocs) {
              // Always update processing documents or if status has changed
              if (
                updatedDoc.status === "processing" ||
                !docMap.has(updatedDoc.id) ||
                docMap.get(updatedDoc.id)?.status !== updatedDoc.status
              ) {
                docMap.set(updatedDoc.id, updatedDoc)
              }
            }

            return Array.from(docMap.values())
          })
        }
      } catch (err) {
        console.error("Error polling documents:", err)
        // Don't update error state to avoid UI disruption during polling
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [documents, user?.id])

  /**
   * Upload a document with progress tracking
   * @param file File to upload
   * @param onProgress Optional progress callback function
   * @returns The created document
   */
  const handleUploadDocument = useCallback(
    async (file: File, onProgress?: (progress: number) => void) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        const newDocument = await uploadDocument(user.id, file, onProgress)

        // Add the new document to the state
        setDocuments((prevDocs) => [newDocument, ...prevDocs])

        return newDocument
      } catch (err) {
        console.error("Error uploading document:", err)
        throw err
      }
    },
    [user?.id],
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
        await deleteDocument(documentId)

        // Remove the deleted document from the state
        setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== documentId))

        return true
      } catch (err) {
        console.error("Error deleting document:", err)
        throw err
      }
    },
    [user?.id],
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
              : doc,
          ),
        )

        return true
      } catch (err) {
        console.error("Error retrying document processing:", err)
        throw err
      }
    },
    [user?.id],
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
