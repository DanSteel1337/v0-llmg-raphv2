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

import { useEffect } from "react"
import { useApi } from "@/hooks/use-api"
import type { Document } from "@/types"

export function useDocuments(userId: string) {
  const {
    data: documents,
    isLoading,
    error,
    execute: fetchDocuments,
  } = useApi<Document[], []>(async () => {
    const response = await fetch(`/api/documents?userId=${userId}`)

    if (!response.ok) {
      throw new Error("Failed to fetch documents")
    }

    const { data } = await response.json()
    return data.documents || []
  })

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const uploadDocument = async (file: File) => {
    try {
      // 1. Upload file to storage
      const formData = new FormData()
      formData.append("file", file)
      formData.append("userId", userId)

      const uploadResponse = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file")
      }

      const { data: uploadData } = await uploadResponse.json()

      // 2. Create document record
      const createResponse = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          name: file.name,
          fileType: file.type,
          fileSize: file.size,
          filePath: uploadData.path,
        }),
      })

      if (!createResponse.ok) {
        throw new Error("Failed to create document record")
      }

      const { data: documentData } = await createResponse.json()

      // 3. Refresh documents list
      await fetchDocuments()

      return documentData.document
    } catch (error) {
      console.error("Error uploading document:", error)
      throw error
    }
  }

  const deleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete document")
      }

      // Refresh documents list
      await fetchDocuments()
    } catch (error) {
      console.error("Error deleting document:", error)
      throw error
    }
  }

  return {
    documents: documents || [],
    isLoading,
    error,
    uploadDocument,
    deleteDocument,
    refreshDocuments: fetchDocuments,
  }
}
