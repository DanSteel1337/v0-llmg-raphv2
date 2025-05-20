/**
 * Document Debug Component
 *
 * A component for debugging document processing status and
 * viewing detailed information about document processing steps.
 *
 * Dependencies:
 * - @/types for document types
 * - @/utils/formatting for date and file size formatting
 */

"use client"

import { useState, useEffect } from "react"
import type { Document } from "@/types"
import { formatDate, formatFileSize } from "@/utils/formatting"
import { AlertTriangle, Clock, FileText, CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react"

interface DocumentDebugProps {
  document: Document
  onRetry?: (documentId: string) => Promise<void>
}

export function DocumentDebug({ document, onRetry }: DocumentDebugProps) {
  const [loading, setLoading] = useState<boolean>(false)
  const [fileContent, setFileContent] = useState<string>("")
  const [showFullContent, setShowFullContent] = useState<boolean>(false)
  const [fileError, setFileError] = useState<string | null>(null)

  // Extract the debug info
  const debugInfo = document.debug_info || {}
  const processingSteps = debugInfo.steps || {}
  const timings = debugInfo.timings || {}

  // Handle retrying document processing
  const handleRetry = async () => {
    if (!onRetry) {
      console.error("Retry function not provided")
      return
    }

    try {
      setLoading(true)
      await onRetry(document.id)
    } catch (error) {
      console.error("Error retrying document processing:", error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch file content for preview
  useEffect(() => {
    const fetchFileContent = async () => {
      if (!document.file_path) return

      try {
        setFileError(null)
        const response = await fetch(`/api/documents/file?path=${encodeURIComponent(document.file_path)}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
        }

        const text = await response.text()
        setFileContent(text)
      } catch (error) {
        console.error("Error fetching file content:", error)
        setFileError(error instanceof Error ? error.message : "Unknown error occurred")
      }
    }

    fetchFileContent()
  }, [document.file_path])

  // Format debug information
  const formatStepStatus = (step: any) => {
    return step?.success ? (
      <span className="text-green-500 flex items-center">
        <CheckCircle className="h-4 w-4 mr-1" /> Success
      </span>
    ) : (
      <span className="text-red-500 flex items-center">
        <XCircle className="h-4 w-4 mr-1" /> Failed
      </span>
    )
  }

  // Get file content preview
  const getFilePreview = () => {
    if (fileError) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md">
          <AlertCircle className="h-4 w-4 inline-block mr-1" />
          Error loading file: {fileError}
        </div>
      )
    }

    if (!fileContent) {
      return <div className="text-gray-500 italic">File content not available</div>
    }

    return (
      <div className="space-y-2">
        <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto max-h-[200px] whitespace-pre-wrap">
          {showFullContent ? fileContent : fileContent.slice(0, 500) + (fileContent.length > 500 ? "..." : "")}
        </pre>
        {fileContent.length > 500 && (
          <button
            onClick={() => setShowFullContent(!showFullContent)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showFullContent ? "Show Less" : "Show Full Content"}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Document Debug</h3>
          {document.status === "failed" && onRetry && (
            <button
              onClick={handleRetry}
              disabled={loading}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" /> Retry Processing
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Basic Information */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Basic Information</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-medium">ID:</span> {document.id}
            </div>
            <div>
              <span className="font-medium">Status:</span>{" "}
              <span
                className={
                  document.status === "indexed"
                    ? "text-green-600"
                    : document.status === "processing"
                      ? "text-blue-600"
                      : "text-red-600"
                }
              >
                {document.status}
              </span>
            </div>
            <div>
              <span className="font-medium">Name:</span> {document.name}
            </div>
            <div>
              <span className="font-medium">File Type:</span> {document.file_type}
            </div>
            <div>
              <span className="font-medium">Size:</span> {formatFileSize(document.file_size)}
            </div>
            <div>
              <span className="font-medium">Created:</span> {formatDate(document.created_at)}
            </div>
            <div>
              <span className="font-medium">Path:</span>{" "}
              <span className="truncate inline-block max-w-[150px]" title={document.file_path}>
                {document.file_path}
              </span>
            </div>
            <div>
              <span className="font-medium">Chunks:</span> {document.chunk_count || "N/A"}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {document.error_message && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-500 mr-1" /> Error Message
            </h4>
            <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded-md text-xs">
              {document.error_message}
            </div>
          </div>
        )}

        {/* Processing Timeline */}
        {debugInfo.processingStartTime && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center">
              <Clock className="h-4 w-4 text-gray-500 mr-1" /> Processing Timeline
            </h4>
            <div className="text-xs space-y-1">
              <div>
                <span className="font-medium">Started:</span> {formatDate(debugInfo.processingStartTime)}
              </div>
              {debugInfo.processingEndTime && (
                <div>
                  <span className="font-medium">Ended:</span> {formatDate(debugInfo.processingEndTime)}
                </div>
              )}
              {debugInfo.totalDuration && (
                <div>
                  <span className="font-medium">Total Duration:</span> {(debugInfo.totalDuration / 1000).toFixed(2)}{" "}
                  seconds
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing Steps */}
        {Object.keys(processingSteps).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Processing Steps</h4>
            <div className="text-xs space-y-3">
              {/* Fetch Content Step */}
              {processingSteps.fetchContent && (
                <div className="border-l-2 pl-3 pb-2 border-blue-200">
                  <div className="flex justify-between">
                    <span className="font-medium">1. Fetch Content</span>
                    {formatStepStatus(processingSteps.fetchContent)}
                  </div>
                  <div className="text-gray-600 mt-1">
                    {processingSteps.fetchContent.retries > 0 && (
                      <div>Retries: {processingSteps.fetchContent.retries}</div>
                    )}
                    {processingSteps.fetchContent.contentLength && (
                      <div>Content Length: {formatFileSize(processingSteps.fetchContent.contentLength)}</div>
                    )}
                    {timings.fetchContentTime && <div>Time: {(timings.fetchContentTime / 1000).toFixed(2)}s</div>}
                    {processingSteps.fetchContent.error && (
                      <div className="text-red-600">Error: {processingSteps.fetchContent.error}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Chunking Step */}
              {processingSteps.chunking && (
                <div className="border-l-2 pl-3 pb-2 border-blue-200">
                  <div className="flex justify-between">
                    <span className="font-medium">2. Chunking</span>
                    {formatStepStatus(processingSteps.chunking)}
                  </div>
                  <div className="text-gray-600 mt-1">
                    <div>Total Chunks: {processingSteps.chunking.totalChunks}</div>
                    <div>Valid Chunks: {processingSteps.chunking.validChunks}</div>
                    <div>Skipped Chunks: {processingSteps.chunking.skippedChunks}</div>
                    {processingSteps.chunking.averageChunkSize && (
                      <div>Avg Chunk Size: {formatFileSize(processingSteps.chunking.averageChunkSize)}</div>
                    )}
                    {timings.chunkingTime && <div>Time: {(timings.chunkingTime / 1000).toFixed(2)}s</div>}
                  </div>
                </div>
              )}

              {/* Embedding Step */}
              {processingSteps.embedding && (
                <div className="border-l-2 pl-3 pb-2 border-blue-200">
                  <div className="flex justify-between">
                    <span className="font-medium">3. Embedding Generation</span>
                    {processingSteps.embedding.successfulEmbeddings > 0 ? (
                      <span className="text-green-500 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" /> {processingSteps.embedding.successfulEmbeddings} chunks
                      </span>
                    ) : (
                      <span className="text-red-500 flex items-center">
                        <XCircle className="h-4 w-4 mr-1" /> Failed
                      </span>
                    )}
                  </div>
                  <div className="text-gray-600 mt-1">
                    <div>Model: {processingSteps.embedding.embeddingModel || "Unknown"}</div>
                    <div>Successful: {processingSteps.embedding.successfulEmbeddings}</div>
                    <div>Failed: {processingSteps.embedding.failedEmbeddings}</div>
                    <div>Vectors Inserted: {processingSteps.embedding.totalVectorsInserted || 0}</div>
                    {processingSteps.embedding.batches && (
                      <div>
                        Batches: {processingSteps.embedding.batches.length} / {processingSteps.embedding.totalBatches}
                      </div>
                    )}
                    {timings.embeddingTime && <div>Time: {(timings.embeddingTime / 1000).toFixed(2)}s</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Content Preview */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 flex items-center">
            <FileText className="h-4 w-4 text-gray-500 mr-1" /> File Content Preview
          </h4>
          {getFilePreview()}
        </div>
      </div>
    </div>
  )
}
