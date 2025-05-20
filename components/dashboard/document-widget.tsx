/**
 * Document Widget Component
 *
 * A dashboard widget for document management, allowing users to upload,
 * view, and delete documents. Shows document processing status and
 * provides detailed information about each document.
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 * - @/hooks/use-documents for document data and operations
 */

"use client"

import { useState, useRef } from "react"
import type React from "react"
import {
  FileText,
  Upload,
  Trash2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCw,
  Info,
  FileQuestion,
} from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useToast } from "@/components/toast"
import { useDocuments } from "@/hooks/use-documents"
import { formatDate, formatFileSize } from "@/utils/formatting"
import { DocumentDebug } from "./document-debug"
import type { Document } from "@/types"

interface DocumentWidgetProps {
  userId: string
}

export function DocumentWidget({ userId }: DocumentWidgetProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showDebug, setShowDebug] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  console.log("Toast initialization result:", useToast())
  console.log("Toast function type:", typeof useToast().toast)

  const {
    documents,
    isLoading,
    error,
    uploadDocument,
    deleteDocument,
    refreshDocuments,
    retryProcessing,
    processingStatus,
  } = useDocuments(userId)

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      setSelectedFile(files[0])
    }
  }

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) {
      addToast("Please select a file to upload", "warning")
      return
    }

    // Check if file is a text file
    if (selectedFile.type !== "text/plain") {
      addToast("Only .txt files are supported at this time", "error")
      return
    }

    // Check file size (limit to 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      addToast("File size exceeds the 10MB limit", "error")
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Upload the document with progress tracking
      await uploadDocument(selectedFile, (progress) => {
        setUploadProgress(progress)
      })

      addToast("Your document has been uploaded and is being processed.", "success")
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Upload error:", error)
      addToast(`Failed to upload document: ${error instanceof Error ? error.message : "Unknown error"}`, "error")
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // Handle document deletion
  const handleDelete = async (documentId: string) => {
    if (!window.confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      return
    }

    try {
      await deleteDocument(documentId)
      addToast("Document deleted successfully", "success")
    } catch (error) {
      console.error("Delete error:", error)
      addToast(`Failed to delete document: ${error instanceof Error ? error.message : "Unknown error"}`, "error")
    }
  }

  // Handle retry processing
  const handleRetry = async (documentId: string) => {
    try {
      await retryProcessing(documentId)
      addToast("Document processing restarted", "info")
    } catch (error) {
      console.error("Retry error:", error)
      addToast(`Failed to restart processing: ${error instanceof Error ? error.message : "Unknown error"}`, "error")
    }
  }

  // Toggle debug view
  const toggleDebug = (documentId: string) => {
    setShowDebug(showDebug === documentId ? null : documentId)
  }

  // Get status badge styling
  const getStatusBadge = (status: string, progress?: number) => {
    switch (status) {
      case "indexed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Indexed
          </span>
        )
      case "processing":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {typeof progress === "number" && progress > 0 ? (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Processing {progress}%
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Processing
              </>
            )}
          </span>
        )
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        )
      case "stalled":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Stalled
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <FileQuestion className="w-3 h-3 mr-1" />
            {status}
          </span>
        )
    }
  }

  // Check if a document is stalled (processing for too long)
  const isDocumentStalled = (document: Document) => {
    if (document.status !== "processing") return false

    // If the document has been processing for more than 5 minutes, consider it stalled
    const processingTime = Date.now() - new Date(document.updated_at).getTime()
    return processingTime > 5 * 60 * 1000 // 5 minutes in milliseconds
  }

  // Get document status with stalled detection
  const getDocumentStatus = (document: Document) => {
    if (isDocumentStalled(document)) {
      return "stalled"
    }
    return document.status
  }

  // Get processing progress for a document
  const getProcessingProgress = (documentId: string) => {
    return processingStatus[documentId]?.progress || 0
  }

  return (
    <DashboardCard title="Documents" description="Upload and manage your documents" isLoading={isLoading}>
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error instanceof Error ? error.message : String(error)}</span>
            </div>
            <button onClick={refreshDocuments} className="mt-2 text-sm text-red-700 hover:text-red-900 underline">
              Retry
            </button>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Upload Document</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                accept=".txt"
                disabled={isUploading}
              />
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="-ml-1 mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </button>
            </div>

            {selectedFile && (
              <div className="text-xs text-gray-500">
                Selected file: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </div>
            )}

            {isUploading && (
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                ></div>
              </div>
            )}

            <div className="text-xs text-gray-500 flex items-start">
              <Info className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
              <span>
                Currently only supporting .txt files. Documents will be processed and made available for search and
                chat.
              </span>
            </div>
          </div>
        </div>

        {/* Documents List */}
        {documents && documents.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {documents.map((document) => {
              const status = getDocumentStatus(document)
              const progress = getProcessingProgress(document.id)

              return (
                <li key={document.id} className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 pt-1">
                        <FileText className="h-6 w-6 text-gray-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{document.name}</h4>
                        <div className="mt-1 flex items-center text-xs text-gray-500">
                          <span>{formatFileSize(document.file_size)}</span>
                          <span className="mx-1">•</span>
                          <span>{formatDate(document.created_at)}</span>
                          <span className="mx-1">•</span>
                          <span>
                            {document.chunk_count !== undefined && document.chunk_count > 0
                              ? `${document.chunk_count} chunks`
                              : "Processing..."}
                          </span>
                        </div>
                        <div className="mt-2">{getStatusBadge(status, progress)}</div>

                        {document.error_message && (
                          <div className="mt-2 text-xs text-red-600 flex items-start">
                            <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{document.error_message}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      {status === "failed" && (
                        <button
                          onClick={() => handleRetry(document.id)}
                          className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          title="Retry processing"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={() => toggleDebug(document.id)}
                        className="inline-flex items-center p-1 border border-gray-300 rounded-full shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        title="Show debug information"
                      >
                        {showDebug === document.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(document.id)}
                        className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Debug Information */}
                  {showDebug === document.id && (
                    <div className="mt-4">
                      <DocumentDebug document={document} onRetry={handleRetry} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by uploading a document.</p>
          </div>
        )}
      </div>
    </DashboardCard>
  )
}
