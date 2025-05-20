// components/dashboard/document-widget.tsx
"use client"

import type React from "react"

import { useState, useCallback, useRef, useEffect } from "react"
import { Trash2, Upload, RefreshCw, AlertCircle, FileText, CheckCircle, Clock, Loader2 } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { formatFileSize, formatDate } from "@/utils/formatting"
import { useToast } from "@/components/toast"
import { useDocuments } from "@/hooks/use-documents"
import { getProcessingStepDescription } from "@/services/client-api-service"
import type { Document } from "@/types"
import { ProcessingStep } from "@/types"

interface DocumentWidgetProps {
  userId: string
}

export function DocumentWidget({ userId }: DocumentWidgetProps) {
  const { documents, isLoading, error, uploadDocument, deleteDocument, retryProcessing, refreshDocuments } =
    useDocuments()

  // Debug toast initialization
  const toastResult = useToast()
  console.log("Toast initialization result:", toastResult)
  const { toast } = toastResult || {}
  console.log("Toast function type:", typeof toast)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<ProcessingStep | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stalledDocuments, setStalledDocuments] = useState<Set<string>>(new Set())
  const [processingDocumentId, setProcessingDocumentId] = useState<string | null>(null)

  // Use this effect to track progress of the currently processing document
  useEffect(() => {
    if (!processingDocumentId) return

    // Find the document in the documents array
    const processingDoc = documents.find((doc) => doc.id === processingDocumentId)
    if (!processingDoc) return

    // Update progress based on document status
    if (processingDoc.status === "indexed") {
      setUploadProgress(100)
      setCurrentStep(ProcessingStep.COMPLETED)
      setProcessingDocumentId(null) // Clear processing document ID
    } else if (processingDoc.status === "failed") {
      setUploadProgress(0)
      setCurrentStep(ProcessingStep.FAILED)
      setProcessingDocumentId(null) // Clear processing document ID
    } else if (processingDoc.status === "processing" && processingDoc.processing_progress !== undefined) {
      // Ensure progress is at least 15% once processing starts
      const progress = Math.max(15, processingDoc.processing_progress)
      setUploadProgress(progress)

      // Determine processing step based on progress
      let step = processingDoc.processing_step
      if (!step) {
        if (progress < 20) step = ProcessingStep.CHUNKING
        else if (progress < 40) step = ProcessingStep.EMBEDDING
        else if (progress < 80) step = ProcessingStep.INDEXING
        else step = ProcessingStep.FINALIZING
      }
      setCurrentStep(step)
    }
  }, [documents, processingDocumentId])

  // Refresh documents more frequently when uploading
  useEffect(() => {
    if (processingDocumentId) {
      const interval = setInterval(() => {
        refreshDocuments()
      }, 2000) // Poll every 2 seconds during active upload
      return () => clearInterval(interval)
    }
  }, [processingDocumentId, refreshDocuments])

  useEffect(() => {
    // Check for documents stuck at 0% for more than 30 seconds
    const stalledIds = new Set<string>()
    const now = Date.now()

    documents.forEach((doc) => {
      try {
        // Safely check if updated_at is a valid date
        const updatedAt = doc.updated_at ? new Date(doc.updated_at) : null
        const updatedTime = updatedAt && !isNaN(updatedAt.getTime()) ? updatedAt.getTime() : 0

        if (
          doc.status === "processing" &&
          (doc.processing_progress === 0 || doc.processing_progress === undefined) &&
          updatedTime > 0 && // Make sure we have a valid timestamp
          updatedTime < now - 30000
        ) {
          stalledIds.add(doc.id)
        }
      } catch (e) {
        console.error(`Error processing document ${doc.id}:`, e)
        // Skip this document if there's an error
      }
    })

    setStalledDocuments(stalledIds)

    // Refresh documents every 10 seconds if there are documents being processed
    const interval = setInterval(() => {
      if (documents.some((doc) => doc.status === "processing")) {
        refreshDocuments()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [documents, refreshDocuments])

  // Safe toast function that won't crash if toast is undefined
  const safeToast = useCallback(
    (props) => {
      console.log("Attempting to call toast with:", props)
      if (typeof toast === "function") {
        try {
          toast(props)
        } catch (e) {
          console.error("Error calling toast:", e)
        }
      } else {
        console.error("Toast is not a function:", typeof toast)
      }
    },
    [toast],
  )

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Validate file type - only accept text files for now
      if (!file.type.includes("text/")) {
        console.log("About to toast error for invalid file type")
        try {
          safeToast({
            title: "Invalid file type",
            description: "Only text files are supported at this time.",
            variant: "destructive",
          })
        } catch (e) {
          console.error("Toast error details:", e)
        }
        return
      }

      // Validate file size - max 10MB
      if (file.size > 10 * 1024 * 1024) {
        console.log("About to toast error for file too large")
        try {
          safeToast({
            title: "File too large",
            description: "Maximum file size is 10MB.",
            variant: "destructive",
          })
        } catch (e) {
          console.error("Toast error details:", e)
        }
        return
      }

      setIsUploading(true)
      setUploadProgress(0)
      setCurrentStep(undefined)

      try {
        // Don't pass a callback - we'll track progress using the document state
        const document = await uploadDocument(file)

        // Set initial progress and step
        setUploadProgress(15)
        setCurrentStep(ProcessingStep.CHUNKING)

        // Store the document ID for tracking
        setProcessingDocumentId(document.id)

        console.log("About to toast success for document uploaded")
        try {
          safeToast({
            title: "Document uploaded",
            description: "Your document has been uploaded and is being processed.",
          })
        } catch (e) {
          console.error("Toast success error details:", e)
        }
      } catch (error) {
        console.error("Error uploading document:", error)
        console.log("About to toast error for upload failed")
        try {
          safeToast({
            title: "Upload failed",
            description: error instanceof Error ? error.message : "An unknown error occurred",
            variant: "destructive",
          })
        } catch (e) {
          console.error("Toast error details:", e)
        }
        setIsUploading(false)
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [uploadDocument, safeToast],
  )

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await deleteDocument(documentId)
        try {
          safeToast({
            title: "Document deleted",
            description: "The document has been removed from your library.",
          })
        } catch (e) {
          console.error("Toast error details:", e)
        }
      } catch (error) {
        console.error("Error deleting document:", error)
        try {
          safeToast({
            title: "Delete failed",
            description: error instanceof Error ? error.message : "An unknown error occurred",
            variant: "destructive",
          })
        } catch (e) {
          console.error("Toast error details:", e)
        }
      }
    },
    [deleteDocument, safeToast],
  )

  const handleRetryProcessing = useCallback(
    async (documentId: string) => {
      try {
        await retryProcessing(documentId)
        try {
          safeToast({
            title: "Processing restarted",
            description: "Document processing has been restarted.",
          })
        } catch (e) {
          console.error("Toast error details:", e)
        }
      } catch (error) {
        console.error("Error retrying document processing:", error)
        try {
          safeToast({
            title: "Retry failed",
            description: error instanceof Error ? error.message : "An unknown error occurred",
            variant: "destructive",
          })
        } catch (e) {
          console.error("Toast error details:", e)
        }
      }
    },
    [retryProcessing, safeToast],
  )

  const handleViewDocument = useCallback((document: Document) => {
    // Check if document has a blob_url property
    const fileUrl = document.blob_url || `/api/documents/file?path=${encodeURIComponent(document.file_path)}`
    window.open(fileUrl, "_blank")
  }, [])

  // Function to get step color based on processing step
  const getStepColor = (step?: ProcessingStep) => {
    switch (step) {
      case ProcessingStep.FAILED:
        return "text-red-600"
      case ProcessingStep.COMPLETED:
        return "text-green-600"
      default:
        return "text-blue-600"
    }
  }

  // When a document is fully processed, clear the uploading state
  useEffect(() => {
    if (isUploading && uploadProgress === 100) {
      // Wait a moment before clearing the uploading state
      const timer = setTimeout(() => {
        setIsUploading(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isUploading, uploadProgress])

  return (
    <DashboardCard title="Documents" description="Upload and manage your documents">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt,.md,.csv" />
        </div>
        {isUploading && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                <span className={getStepColor(currentStep)}>
                  {currentStep ? getProcessingStepDescription(currentStep) : "Uploading document"}
                </span>{" "}
                ({uploadProgress}%)
              </p>
              <div className="flex items-center text-xs text-gray-500">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Processing...
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
          <div className="flex">
            <AlertCircle className="mr-2 h-5 w-5" />
            <p>Error loading documents: {error}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.length === 0 ? (
            <div className="rounded-md bg-gray-50 p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
              <p className="mt-1 text-sm text-gray-500">Upload a document to get started.</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="border border-gray-200 rounded-md overflow-hidden bg-white">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b">
                  <div className="mb-2 sm:mb-0">
                    <h3 className="text-sm font-medium">{doc.name}</h3>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center">
                    {doc.status === "processing" ? (
                      <div className="flex items-center text-amber-600">
                        <Clock className="mr-1 h-4 w-4" />
                        <span className="text-xs">
                          Processing {doc.processing_progress || 0}%
                          {stalledDocuments.has(doc.id) && (
                            <button
                              className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                              onClick={() => handleRetryProcessing(doc.id)}
                            >
                              <RefreshCw className="inline mr-1 h-3 w-3" />
                              Restart
                            </button>
                          )}
                        </span>
                      </div>
                    ) : doc.status === "indexed" ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="mr-1 h-4 w-4" />
                        <span className="text-xs">Indexed</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="mr-1 h-4 w-4" />
                        <span className="text-xs">Failed</span>
                      </div>
                    )}
                  </div>
                </div>
                {doc.status === "processing" && (
                  <div>
                    <div className="w-full bg-gray-200 h-1">
                      <div className="bg-blue-600 h-1" style={{ width: `${doc.processing_progress || 0}%` }}></div>
                    </div>
                    {doc.processing_step && (
                      <div className="px-4 py-1 text-xs text-gray-600 bg-gray-50">
                        <span className={getStepColor(doc.processing_step)}>
                          {getProcessingStepDescription(doc.processing_step)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {doc.status === "failed" && doc.error_message && (
                  <div className="bg-red-50 p-3 text-xs text-red-800">
                    <p className="font-medium">Error: {doc.error_message}</p>
                  </div>
                )}
                <div className="p-2 flex justify-between items-center">
                  <button
                    className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center"
                    onClick={() => handleViewDocument(doc)}
                  >
                    <FileText className="mr-1 h-4 w-4" />
                    View
                  </button>
                  <div className="flex space-x-1">
                    {doc.status === "failed" && (
                      <button
                        className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center"
                        onClick={() => handleRetryProcessing(doc.id)}
                      >
                        <RefreshCw className="mr-1 h-4 w-4" />
                        Retry
                      </button>
                    )}
                    <button
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center"
                      onClick={() => handleDeleteDocument(doc.id)}
                      disabled={doc.status === "processing"}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </DashboardCard>
  )
}
