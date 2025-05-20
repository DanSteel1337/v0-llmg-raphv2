/**
 * Document Management Hook
 *
 * React hook for managing documents in the Vector RAG application.
 * Provides functionality for fetching, uploading, deleting, and retrying document processing.
 *
 * Dependencies:
 * - @/services/client-api-service for API interactions
 * - @/types for document types
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./use-auth"
import { fetchDocuments, uploadDocument, deleteDocument, retryDocumentProcessing } from "@/services/client-api-service"
import type { Document } from "@/types"

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

  // Upload a document
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

  // Delete a document
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

  // Retry processing a failed document
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

  // Refresh documents
  const handleRefreshDocuments = useCallback(async () => {
    if (!user?.id) {
      return
    }

    try {
      const docs = await fetchDocuments(user.id)
      setDocuments(docs)
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
