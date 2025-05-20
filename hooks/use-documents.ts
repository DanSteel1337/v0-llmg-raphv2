// hooks/use-documents.ts
"use client"

import { useState, useCallback, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import {
  fetchDocuments as fetchDocumentsApi,
  uploadDocument as uploadDocumentApi,
  deleteDocument as deleteDocumentApi,
  retryDocumentProcessing as retryDocumentProcessingApi,
} from "@/services/client-api-service"
import type { Document } from "@/types"

export function useDocuments() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    if (!user?.id) {
      setDocuments([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const docs = await fetchDocumentsApi(user.id)
      setDocuments(docs)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch documents")
      console.error("Error fetching documents:", err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  const uploadDocument = useCallback(
    async (file: File): Promise<Document> => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        // Don't pass a callback - we'll track progress using the document state
        const document = await uploadDocumentApi(user.id, file)

        // Refresh the documents list to include the new document
        fetchDocuments()

        return document
      } catch (err) {
        console.error("Error uploading document:", err)
        throw err
      }
    },
    [user?.id, fetchDocuments],
  )

  const deleteDocument = useCallback(async (documentId: string): Promise<void> => {
    try {
      await deleteDocumentApi(documentId)
      // Update local state to remove the deleted document
      setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== documentId))
    } catch (err) {
      console.error("Error deleting document:", err)
      throw err
    }
  }, [])

  const retryProcessing = useCallback(
    async (documentId: string): Promise<void> => {
      try {
        await retryDocumentProcessingApi(documentId)
        // Refresh documents to get updated status
        fetchDocuments()
      } catch (err) {
        console.error("Error retrying document processing:", err)
        throw err
      }
    },
    [fetchDocuments],
  )

  // Fetch documents on mount and when user changes
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
