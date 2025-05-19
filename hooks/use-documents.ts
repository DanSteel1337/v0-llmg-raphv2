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

import { useEffect, useCallback } from "react"
import { useApi } from "@/hooks/use-api"
import { fetchDocuments, uploadDocument, deleteDocument } from "@/services/client-api-service"
import type { Document } from "@/types"

export function useDocuments(userId: string) {
  // Wrap the fetchDocuments call with useCallback to create a stable reference
  const fetchDocumentsCallback = useCallback(() => {
    return fetchDocuments(userId)
  }, [userId])

  const {
    data: documents,
    isLoading,
    error,
    execute: fetchDocumentsData,
  } = useApi<Document[], []>(fetchDocumentsCallback)

  useEffect(() => {
    fetchDocumentsData()
  }, [fetchDocumentsData])

  const handleUploadDocument = async (file: File) => {
    try {
      const document = await uploadDocument(userId, file)

      // Refresh documents list
      await fetchDocumentsData()

      return document
    } catch (error) {
      console.error("Error uploading document:", error)
      throw error
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id)

      // Refresh documents list
      await fetchDocumentsData()
    } catch (error) {
      console.error("Error deleting document:", error)
      throw error
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
