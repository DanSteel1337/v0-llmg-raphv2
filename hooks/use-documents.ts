// hooks/use-documents.ts

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "./use-auth"
import { 
  fetchDocuments, 
  uploadDocument as apiUploadDocument, 
  deleteDocument as apiDeleteDocument, 
  retryDocumentProcessing 
} from "@/services/client-api-service"
import type { Document } from "@/types"

export function useDocuments() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch documents when user changes
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

  // Add polling for in-progress documents
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
            // Create a map of existing documents
            const docMap = new Map(prevDocs.map((doc) => [doc.id, doc]))
            
            // Update with latest data
            for (const updatedDoc of updatedDocs) {
              docMap.set(updatedDoc.id, updatedDoc)
            }
            
            return Array.from(docMap.values())
          })
        }
      } catch (err) {
        console.error("Error polling documents:", err)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [documents, user?.id])

  // Upload document function
  const handleUploadDocument = useCallback(
    async (file: File, onProgress?: (progress: number) => void) => {
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

  // Delete document function
  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        const result = await apiDeleteDocument(documentId)

        if (result.success) {
          // Remove the deleted document from the state
          setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== documentId))
        }

        return result.success
      } catch (err) {
        console.error("Error deleting document:", err)
        throw err
      }
    },
    [user?.id]
  )

  // Retry processing function
  const handleRetryProcessing = useCallback(
    async (documentId: string) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        const result = await retryDocumentProcessing(documentId)

        if (result.success) {
          // Update the document status in the state
          setDocuments((prevDocs) =>
            prevDocs.map((doc) =>
              doc.id === documentId
                ? { ...doc, status: "processing", processing_progress: 0, error_message: undefined }
                : doc
            )
          )
        }

        return result.success
      } catch (err) {
        console.error("Error retrying document processing:", err)
        throw err
      }
    },
    [user?.id]
  )

  // Manual refresh function
  const handleRefreshDocuments = useCallback(async () => {
    if (!user?.id) {
      return []
    }

    try {
      setError(null)
      const docs = await fetchDocuments(user.id)
      setDocuments(docs)
      return docs
    } catch (err) {
      console.error("Error refreshing documents:", err)
      setError(err instanceof Error ? err.message : "Failed to refresh documents")
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
