/**
 * Documents Hook
 *
 * Custom hook for managing document operations including fetching, uploading,
 * deleting, and processing documents.
 *
 * Dependencies:
 * - @/services/client-api-service for API calls
 * - @/components/toast for notifications
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import {
  fetchDocuments,
  uploadDocumentWithProgress,
  deleteDocument as apiDeleteDocument,
  retryDocumentProcessing,
} from "@/services/client-api-service"
import type { Document, ProcessingStatus } from "@/types"
import { useToast } from "@/components/toast"

export function useDocuments(userId?: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<Record<string, ProcessingStatus>>({})
  const { addToast } = useToast()

  // Fetch documents
  const refreshDocuments = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchDocuments(userId)
      setDocuments(data)
    } catch (err) {
      console.error("Error fetching documents:", err)
      setError(err instanceof Error ? err.message : "Failed to load documents")
      addToast("Failed to load documents", "error")
    } finally {
      setIsLoading(false)
    }
  }, [userId, addToast])

  // Initial fetch
  useEffect(() => {
    if (userId) {
      refreshDocuments()
    }
  }, [userId, refreshDocuments])

  // Upload document
  const uploadDocument = useCallback(
    async (file: File) => {
      if (!userId) {
        throw new Error("User ID is required")
      }

      try {
        const document = await uploadDocumentWithProgress(file, userId, (progress, step) => {
          // Update processing status for this document
          setProcessingStatus((prev) => ({
            ...prev,
            [document.id]: { progress, step },
          }))
        })

        // Add the new document to the list
        setDocuments((prev) => [document, ...prev])
        return document
      } catch (error) {
        console.error("Error uploading document:", error)
        addToast(`Failed to upload document: ${error instanceof Error ? error.message : "Unknown error"}`, "error")
        throw error
      }
    },
    [userId, addToast],
  )

  // Delete document
  const deleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await apiDeleteDocument(documentId)
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId))
        return true
      } catch (error) {
        console.error("Error deleting document:", error)
        addToast(`Failed to delete document: ${error instanceof Error ? error.message : "Unknown error"}`, "error")
        throw error
      }
    },
    [addToast],
  )

  // Retry processing
  const retryProcessing = useCallback(
    async (documentId: string) => {
      try {
        await retryDocumentProcessing(documentId)
        // Update the document status
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  status: "processing",
                  error_message: null,
                  processing_progress: 0,
                }
              : doc,
          ),
        )
        return true
      } catch (error) {
        console.error("Error retrying document processing:", error)
        addToast(
          `Failed to restart document processing: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        )
        throw error
      }
    },
    [addToast],
  )

  return {
    documents,
    isLoading,
    error,
    uploadDocument,
    deleteDocument,
    refreshDocuments,
    retryProcessing,
    processingStatus,
  }
}
