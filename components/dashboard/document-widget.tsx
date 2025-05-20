/**
 * Document Widget Component
 *
 * A dashboard widget for document upload and listing.
 * Handles optimistic UI updates and monitors document processing progress.
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 * - @/hooks/use-documents for document operations
 * - @/utils/formatting for display formatting
 * - @/components/toast for notifications
 */

"use client"

import type React from "react"
import type { Document } from "@/types"

import { useState, useRef, useEffect } from "react"
import { FileText, Upload, AlertCircle, CheckCircle, HelpCircle, Trash } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useDocuments } from "@/hooks/use-documents"
import { formatFileSize, formatDate } from "@/utils/formatting"
import { useToast } from "@/components/toast"

interface DocumentWidgetProps {
  userId: string
  limit?: number
}

export function DocumentWidget({ userId, limit = 5 }: DocumentWidgetProps) {
  const { documents, isLoading, error, uploadDocument, refreshDocuments, deleteDocument } = useDocuments(userId)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set())
  const [processingTimeouts, setProcessingTimeouts] = useState<Record<string, NodeJS.Timeout>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  // Handle API errors
  useEffect(() => {
    if (error) {
      console.error("Document widget error:", error)
      setErrorMessage(error instanceof Error ? error.message : String(error))
      addToast("Failed to load documents: " + (error instanceof Error ? error.message : "Unknown error"), "error")
    } else {
      setErrorMessage(null)
    }
  }, [error, addToast])

  // Track processing documents and set up polling
  useEffect(() => {
    if (!Array.isArray(documents)) return

    // Find documents that are still processing
    const currentlyProcessing = new Set<string>()
    documents.forEach((doc) => {
      if (doc.status === "processing") {
        currentlyProcessing.add(doc.id)

        // Set up timeout warning for documents that have been processing for too long
        if (!processingTimeouts[doc.id]) {
          const timeout = setTimeout(() => {
            addToast(`Document "${doc.name}" is taking longer than expected to process.`, "warning")
          }, 60000) // 60 seconds

          setProcessingTimeouts((prev) => ({
            ...prev,
            [doc.id]: timeout,
          }))
        }
      } else if (processingTimeouts[doc.id]) {
        // Clear timeout for documents that are no longer processing
        clearTimeout(processingTimeouts[doc.id])
        setProcessingTimeouts((prev) => {
          const newTimeouts = { ...prev }
          delete newTimeouts[doc.id]
          return newTimeouts
        })
      }
    })

    setProcessingDocuments(currentlyProcessing)

    // If we have processing documents, poll for updates
    if (currentlyProcessing.size > 0) {
      const pollInterval = setInterval(() => {
        refreshDocuments()
      }, 5000) // Poll every 5 seconds

      return () => clearInterval(pollInterval)
    }
  }, [documents, processingTimeouts, addToast, refreshDocuments])

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(processingTimeouts).forEach((timeout) => clearTimeout(timeout))
    }
  }, [processingTimeouts])

  // Retry loading documents if there was an error
  const handleRetry = () => {
    setErrorMessage(null)
    refreshDocuments()
  }

  // Ensure documents is always an array
  const safeDocuments = Array.isArray(documents) ? documents : []
  // Get the recent documents safely
  const recentDocuments = safeDocuments.slice(0, limit)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
      setErrorMessage("Only .txt files are supported")
      addToast("Only .txt files are supported", "error")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File size must be less than 10MB")
      addToast("File size must be less than 10MB", "error")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      return
    }

    try {
      setIsUploading(true)
      setErrorMessage(null)

      const document = await uploadDocument(file, (progress) => {
        console.log(`Upload progress: ${progress}%`)
      })

      // Add validation here
      console.log("Document widget upload response:", document)
      if (!document?.id) {
        throw new Error("Document upload failed: Missing document ID in response")
      }

      addToast("Document uploaded successfully and processing started", "success")

      // Refresh documents to show the new one
      refreshDocuments()
    } catch (error) {
      console.error("Upload error:", error)
      const message = error instanceof Error ? error.message : "Unknown error occurred"
      setErrorMessage(`Failed to upload: ${message}`)
      addToast("Failed to upload document: " + message, "error")
    } finally {
      setIsUploading(false)
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const getStatusIcon = (status: Document["status"]) => {
    switch (status) {
      case "indexed":
        return <CheckCircle className="h-5 w-5 text-green-500" title="Indexed" />
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" title="Failed" />
      case "processing":
        return (
          <div
            className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
            title="Processing"
          ></div>
        )
      default:
        return <HelpCircle className="h-5 w-5 text-gray-500" title="Unknown status" />
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument(documentId)
      addToast("Document deleted successfully", "success")
      refreshDocuments()
    } catch (error) {
      console.error("Delete error:", error)
      const message = error instanceof Error ? error.message : "Unknown error occurred"
      addToast("Failed to delete document: " + message, "error")
    }
  }

  return (
    <DashboardCard title="Documents" description="Recently uploaded documents" isLoading={isLoading && !isUploading}>
      <div className="space-y-4">
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={handleRetry} className="mt-2 text-sm text-red-700 hover:text-red-900 underline">
              Retry
            </button>
          </div>
        )}

        <button
          onClick={handleUploadClick}
          disabled={isUploading}
          className="w-full flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isUploading ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </>
          )}
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt" />

        {processingDocuments.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md">
            <div className="flex items-center">
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span>Processing {processingDocuments.size} document(s)...</span>
            </div>
          </div>
        )}

        {recentDocuments.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {recentDocuments.map((doc) => (
              <li key={doc.id} className="py-3 flex justify-between items-center">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                      {doc.status === "processing" && doc.processing_progress !== undefined && (
                        <span className="ml-2 text-blue-500">{Math.round(doc.processing_progress)}%</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(doc.status)}
                  {doc.status !== "processing" && (
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete document"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4 text-gray-500">
            {errorMessage
              ? "Unable to load documents. Please try again."
              : "No documents yet. Upload your first document to get started."}
          </div>
        )}
      </div>
    </DashboardCard>
  )
}
