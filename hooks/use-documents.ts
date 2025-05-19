/**
 * Documents Hook
 *
 * Custom hook for managing document operations including fetching,
 * uploading, and deleting documents.
 *
 * Dependencies:
 * - @/hooks/use-api for API interaction
 * - @/types for document types
 */

"use client"

import { useEffect, useCallback, useState } from "react"
import { useApi } from "@/hooks/use-api"
import { fetchDocuments, uploadDocument, deleteDocument } from "@/services/client-api-service"
import type { Document } from "@/types"

export function useDocuments(userId: string) {
  const [error, setError] = useState<Error | null>(null)

  // Wrap the fetchDocuments call with useCallback to create a stable reference
  const fetchDocumentsCallback = useCallback(() => {
    return fetchDocuments(userId).catch((err) => {
      // Handle 405 errors gracefully
      if (err instanceof Error && err.message.includes("405")) {
        console.error("API method not allowed. The documents endpoint might not support GET requests.")
        setError(new Error("Unable to load documents. This feature is not available."))
        return []
      }
      setError(err)
      throw err
    })
  }, [userId])

  const { data: documents, isLoading, execute: fetchDocumentsData } = useApi<Document[], []>(fetchDocumentsCallback)

  useEffect(() => {
    fetchDocumentsData()
  }, [fetchDocumentsData])

  const handleUploadDocument = async (file: File) => {
    try {
      setError(null)
      const document = await uploadDocument(userId, file)

      // Add validation here
      console.log("Upload document response:", document)
      if (!document?.id) {
        throw new Error("Document upload failed: Missing document ID in response")
      }

      // Refresh documents list
      await fetchDocumentsData()

      return document
    } catch (err) {
      console.error("Error uploading document:", err)

      // Handle 405 errors gracefully
      if (err instanceof Error && err.message.includes("405")) {
        setError(new Error("Document upload is not available. The server does not support this feature."))
      } else {
        setError(err instanceof Error ? err : new Error("Unknown error during document upload"))
      }

      throw err
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      setError(null)
      await deleteDocument(id)

      // Refresh documents list
      await fetchDocumentsData()
    } catch (err) {
      console.error("Error deleting document:", err)

      // Handle 405 errors gracefully
      if (err instanceof Error && err.message.includes("405")) {
        setError(new Error("Document deletion is not available. The server does not support this feature."))
      } else {
        setError(err instanceof Error ? err : new Error("Unknown error during document deletion"))
      }

      throw err
    }
  }

  return {
    documents: documents || [],
    isLoading,
    error,
    uploadDocument: handleUploadDocument,
    deleteDocument: handleDeleteDocument,
    refreshDocuments: fetchDocumentsData,
  }
}
