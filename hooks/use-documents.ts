/**
 * Documents Hook
 *
 * Custom hook for document management operations.
 * Provides functionality for listing, uploading, deleting, and retrying document processing.
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import type { Document } from "@/types"

// Direct fetch-based API implementation to avoid potential issues with utility functions
export function useDocuments(userId?: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDocuments = useCallback(async () => {
    if (!userId) {
      setDocuments([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Direct fetch call instead of using apiCall
      const response = await fetch(`/api/documents?userId=${encodeURIComponent(userId)}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (!data || !data.documents) {
        console.warn("Received invalid response from documents API", { data })
        setDocuments([])
      } else {
        setDocuments(Array.isArray(data.documents) ? data.documents : [])
      }
    } catch (err) {
      console.error("Error fetching documents:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const uploadDocument = useCallback(
    async (file: File, onProgress?: (progress: number) => void): Promise<Document> => {
      if (!userId) {
        throw new Error("User ID is required")
      }

      try {
        // Create a FormData object to send the file
        const formData = new FormData()
        formData.append("file", file)
        formData.append("userId", userId)

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

        await fetchDocuments()

        return result.document
      } catch (err) {
        console.error("Error uploading document:", err)
        throw err instanceof Error ? err : new Error(String(err))
      }
    },
    [userId, fetchDocuments]
  )

  const deleteDocument = useCallback(
    async (documentId: string): Promise<void> => {
      if (!documentId) {
        throw new Error("Document ID is required")
      }

      try {
        // Direct fetch call
        const response = await fetch(`/api/documents/${documentId}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`)
        }

        // Update local state to remove the deleted document
        setDocuments((prevDocuments) => prevDocuments.filter((doc) => doc.id !== documentId))
      } catch (err) {
        console.error("Error deleting document:", err)
        throw err instanceof Error ? err : new Error(String(err))
      }
    },
    []
  )

  // Properly implement retryDocumentProcessing function using direct fetch
  const retryDocumentProcessing = useCallback(
    async (documentId: string): Promise<void> => {
      if (!documentId) {
        throw new Error("Document ID is required")
      }

      console.log("Retrying document processing:", documentId)

      try {
        // Direct fetch implementation
        const response = await fetch("/api/documents/retry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ documentId }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Retry failed with status: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || "Failed to retry document processing")
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
              : doc
          )
        )
        
        // Refresh documents to get updated status
        // Use a slight delay to ensure the backend has processed the request
        setTimeout(() => fetchDocuments(), 1000)
      } catch (err) {
        console.error("Error retrying document processing:", err)
        throw err instanceof Error ? err : new Error(String(err))
      }
    },
    [fetchDocuments]
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
