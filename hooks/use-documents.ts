"use client"

/**
 * Documents Hook
 *
 * Custom hook for document management operations.
 * Provides functionality for listing, uploading, deleting, and retrying document processing.
 */

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./use-auth"
import { useApi } from "./use-api"
import type { Document } from "@/types"

export function useDocuments(userId?: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { session } = useAuth()
  const { apiCall } = useApi()

  const effectiveUserId = userId || session?.user?.id

  const fetchDocuments = useCallback(async () => {
    if (!effectiveUserId) {
      setDocuments([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await apiCall(`/api/documents?userId=${effectiveUserId}`, {
        method: "GET",
      })

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch documents")
      }

      setDocuments(response.data || [])
    } catch (err) {
      console.error("Error fetching documents:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [effectiveUserId, apiCall])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const uploadDocument = useCallback(
    async (file: File, onProgress?: (progress: number) => void): Promise<Document> => {
      if (!effectiveUserId) {
        throw new Error("User ID is required")
      }

      try {
        // Create a FormData object to send the file
        const formData = new FormData()
        formData.append("file", file)
        formData.append("userId", effectiveUserId)

        // Use fetch directly for FormData and to track upload progress
        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Upload failed with status: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || "Upload failed")
        }

        return result.data
      } catch (err) {
        console.error("Error uploading document:", err)
        throw err instanceof Error ? err : new Error(String(err))
      }
    },
    [effectiveUserId],
  )

  const deleteDocument = useCallback(
    async (documentId: string): Promise<void> => {
      if (!effectiveUserId) {
        throw new Error("User ID is required")
      }

      try {
        const response = await apiCall(`/api/documents/${documentId}`, {
          method: "DELETE",
        })

        if (!response.success) {
          throw new Error(response.error || "Failed to delete document")
        }

        // Update local state to remove the deleted document
        setDocuments((prevDocuments) => prevDocuments.filter((doc) => doc.id !== documentId))
      } catch (err) {
        console.error("Error deleting document:", err)
        throw err instanceof Error ? err : new Error(String(err))
      }
    },
    [effectiveUserId, apiCall],
  )

  const retryDocumentProcessing = useCallback(
    async (documentId: string): Promise<void> => {
      if (!effectiveUserId) {
        throw new Error("User ID is required")
      }

      try {
        const response = await apiCall(`/api/documents/retry`, {
          method: "POST",
          body: JSON.stringify({ documentId }),
        })

        if (!response.success) {
          throw new Error(response.error || "Failed to retry document processing")
        }

        // Update local state to reflect the document is now processing
        setDocuments((prevDocuments) =>
          prevDocuments.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  status: "processing",
                  processing_progress: 0,
                  error_message: undefined,
                  updated_at: new Date().toISOString(),
                }
              : doc,
          ),
        )
      } catch (err) {
        console.error("Error retrying document processing:", err)
        throw err instanceof Error ? err : new Error(String(err))
      }
    },
    [effectiveUserId, apiCall],
  )

  return {
    documents,
    isLoading,
    error,
    uploadDocument,
    refreshDocuments: fetchDocuments,
    deleteDocument,
    retryDocumentProcessing,
  }
}
