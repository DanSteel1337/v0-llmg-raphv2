// Info: This hook implements document management using API routes that use Pinecone for storage
"use client"

import { useState, useEffect } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"

interface Document {
  id: string
  name: string
  description?: string
  file_type: string
  file_size: number
  file_path: string
  status: "processing" | "indexed" | "failed"
  processing_progress?: number
  error_message?: string
  created_at: string
  updated_at: string
}

export function useDocuments(userId: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/documents?userId=${userId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch documents")
      }

      const data = await response.json()
      setDocuments(data.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching documents:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const uploadDocument = async (file: File, description?: string) => {
    try {
      // Use the singleton Supabase client for file storage only
      const supabase = getSupabaseBrowserClient()

      const fileName = `${Date.now()}-${file.name}`
      const filePath = `${userId}/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage.from("documents").upload(filePath, file)

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`)
      }

      // Then, create a document record in Pinecone via API
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          name: file.name,
          description,
          fileType: file.name.split(".").pop()?.toUpperCase() || "UNKNOWN",
          fileSize: file.size,
          filePath: uploadData.path,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create document record")
      }

      const data = await response.json()

      // Add the new document to the state
      setDocuments((prev) => [data.document, ...prev])

      return data.document
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error uploading document:", err)
      throw err
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

      // Remove the document from the state
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error deleting document:", err)
      throw err
    }
  }

  useEffect(() => {
    if (userId) {
      fetchDocuments()
    }
  }, [userId])

  return {
    documents,
    isLoading,
    error,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
  }
}
