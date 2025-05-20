/**
 * Documents Hook
 *
 * Custom hook for document management operations.
 * Provides functionality for listing, uploading, deleting, and retrying document processing.
 * 
 * IMPORTANT:
 * - Always use consistent error handling and response formats
 * - Document IDs should follow the `doc_${timestamp}_${random}` pattern
 * - Only make direct fetch calls from server-side code
 * - All client-side operations should go through API endpoints
 * - Always update local state optimistically when possible
 * 
 * Dependencies:
 * - Fetch API for network requests
 * - React hooks for state management
 * 
 * @module hooks/use-documents
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

        // First, create the document metadata
        const createResponse = await fetch("/api/documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            name: file.name,
            fileType: file.type || "text/plain",
            fileSize: file.size,
            filePath: `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
          }),
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to create document: ${createResponse.status}`)
        }

        const createResult = await createResponse.json()
        
        if (!createResult.success) {
          throw new Error(createResult.error || "Failed to create document metadata")
        }

        const document = createResult.document
        if (!document?.id) {
          throw new Error("Invalid document response - missing document ID")
        }

        // Next, upload the file content
        formData.append("documentId", document.id)
        formData.append("filePath", document.file_path)

        const uploadResponse = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}))
          throw new Error(errorData.error || `Upload failed with status: ${uploadResponse.status}`)
        }

        const uploadResult = await uploadResponse.json()

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Upload failed")
        }

        const fileUrl = uploadResult.fileUrl || `/api/documents/file?path=${encodeURIComponent(document.file_path)}`

        // Finally, trigger the document processing
        const processResponse = await fetch("/api/documents/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId: document.id,
            userId,
            filePath: document.file_path,
            fileName: file.name,
            fileType: file.type || "text/plain",
            fileUrl,
          }),
        })

        if (!processResponse.ok) {
          const errorData = await processResponse.json().catch(() => ({}))
          throw new Error(errorData.error || `Processing failed with status: ${processResponse.status}`)
        }

        const processResult = await processResponse.json()

        if (!processResult.success) {
          throw new Error(processResult.error || "Failed to start document processing")
        }

        // Update local state to include the new document
        setDocuments((prevDocuments) => [document, ...prevDocuments])

        // Poll for document status updates if progress callback provided
        if (onProgress) {
          const pollInterval = setInterval(async () => {
            try {
              await fetchDocuments()
              const updatedDocument = documents.find((d) => d.id === document.id)

              if (updatedDocument) {
                if (updatedDocument.status === "indexed" || updatedDocument.status === "failed") {
                  clearInterval(pollInterval)
                  onProgress(updatedDocument.status === "indexed" ? 100 : 0)
                } else if (updatedDocument.processing_progress !== undefined) {
                  onProgress(updatedDocument.processing_progress)
                }
              }
            } catch (error) {
              console.error("Error polling document status:", error)
            }
          }, 2000)

          // Clean up interval after 5 minutes (max processing time)
          setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000)
        }

        await fetchDocuments()
        return document
      } catch (err) {
        console.error("Error uploading document:", err)
        throw err instanceof Error ? err : new Error(String(err))
      }
    },
    [userId, fetchDocuments, documents]
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
      } catch (error) {
        console.error("Error deleting document:", error)
        throw error instanceof Error ? error : new Error(String(error))
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
