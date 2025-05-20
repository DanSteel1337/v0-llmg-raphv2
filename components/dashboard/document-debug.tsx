/**
 * Document Debug Component
 *
 * Displays detailed document processing information and provides
 * debugging tools for document processing issues.
 *
 * Features:
 * - Detailed document status display
 * - Processing steps visualization
 * - Error message display with context
 * - Retry processing button
 * - Document content preview
 */

"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle, Clock, RefreshCw, ChevronDown, ChevronUp, FileText } from "lucide-react"
import { formatDate, formatFileSize } from "@/utils/formatting"
import { useToast } from "@/components/toast"

interface DocumentDebugProps {
  document: any
  onRetry?: (documentId: string) => Promise<void>
}

export function DocumentDebug({ document, onRetry }: DocumentDebugProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const { addToast } = useToast()

  if (!document) {
    return (
      <div className="bg-gray-50 p-4 rounded-md">
        <div className="flex items-center text-gray-500">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>No document selected</span>
        </div>
      </div>
    )
  }

  // Handle retry with proper error handling
  const handleRetry = async () => {
    // First verify onRetry is a function
    if (!onRetry || typeof onRetry !== 'function') {
      console.error("Retry function not available or not a function:", onRetry);
      addToast("Retry function not available", "error");
      return;
    }

    try {
      setIsRetrying(true);
      console.log(`Attempting to retry document processing for ID: ${document.id}`);
      
      // Call the retry function and wait for it to complete
      await onRetry(document.id);
      
      // Success message
      addToast("Document processing retry initiated", "success");
    } catch (error) {
      console.error("Retry error:", error);
      
      // Detailed error logging
      if (error instanceof Error) {
        console.error(`Error details: ${error.message}`, error.stack);
      }
      
      addToast(
        "Failed to retry document processing: " + (error instanceof Error ? error.message : "Unknown error"),
        "error"
      );
    } finally {
      setIsRetrying(false);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "indexed":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case "processing":
        return <Clock className="h-5 w-5 text-blue-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case "indexed":
        return "bg-green-50 text-green-700 border-green-200"
      case "failed":
        return "bg-red-50 text-red-700 border-red-200"
      case "processing":
        return "bg-blue-50 text-blue-700 border-blue-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  const debugInfo = document.debug_info || {}
  const steps = debugInfo.steps || {}
  const timings = debugInfo.timings || {}

  // Format timings for display
  const formattedTimings = Object.entries(timings).map(([key, value]) => ({
    name: key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
    value: typeof value === "number" ? `${value.toFixed(2)}ms` : String(value),
  }))

  return (
    <div className={`border rounded-md ${getStatusClass(document.status)}`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {getStatusIcon(document.status)}
            <h3 className="ml-2 text-lg font-medium">{document.name}</h3>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-500 hover:text-gray-700"
            aria-label={showDetails ? "Hide details" : "Show details"}
          >
            {showDetails ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        <div className="mt-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Status: {document.status}</span>
            <span>{formatFileSize(document.file_size)}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Last updated: {formatDate(document.updated_at)}</div>
          {document.status === "processing" && document.processing_progress !== undefined && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Processing: {Math.round(document.processing_progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.round(document.processing_progress)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {document.status === "failed" && document.error_message && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Processing failed</p>
                <p className="mt-1">{document.error_message}</p>
              </div>
            </div>
          </div>
        )}

        {document.status !== "processing" && onRetry && (
          <div className="mt-3">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center justify-center w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Processing
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {showDetails && (
        <div className="border-t px-4 py-3 text-sm">
          <h4 className="font-medium mb-2">Processing Details</h4>

          {debugInfo.processingStartTime && (
            <div className="mb-2">
              <p className="text-xs text-gray-500">Started: {formatDate(debugInfo.processingStartTime)}</p>
              {debugInfo.processingEndTime && (
                <p className="text-xs text-gray-500">Completed: {formatDate(debugInfo.processingEndTime)}</p>
              )}
              {debugInfo.totalDuration && (
                <p className="text-xs text-gray-500">Total Duration: {(debugInfo.totalDuration / 1000).toFixed(2)}s</p>
              )}
              {debugInfo.isRetry && <p className="text-xs text-blue-500 mt-1">This was a retry attempt</p>}
            </div>
          )}

          {/* Processing Steps */}
          <div className="mt-3">
            <h5 className="font-medium text-xs uppercase text-gray-500 mb-2">Processing Steps</h5>
            <div className="space-y-2">
              {/* Fetch Content Step */}
              {steps.fetchContent && (
                <div className={`p-2 rounded ${steps.fetchContent.success ? "bg-green-50" : "bg-red-50"}`}>
                  <div className="flex items-center">
                    {steps.fetchContent.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                    )}
                    <span className="font-medium">Fetch Content</span>
                  </div>
                  {steps.fetchContent.success ? (
                    <div className="mt-1 text-xs text-gray-600">
                      <p>Content Size: {formatFileSize(steps.fetchContent.contentLength || 0)}</p>
                      {steps.fetchContent.retries > 0 && <p>Retries: {steps.fetchContent.retries}</p>}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-red-600">
                      <p>Error: {steps.fetchContent.error}</p>
                      {steps.fetchContent.retries > 0 && <p>Retries: {steps.fetchContent.retries}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Chunking Step */}
              {steps.chunking && (
                <div className={`p-2 rounded ${steps.chunking.success ? "bg-green-50" : "bg-red-50"}`}>
                  <div className="flex items-center">
                    {steps.chunking.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                    )}
                    <span className="font-medium">Chunking</span>
                  </div>
                  {steps.chunking.success ? (
                    <div className="mt-1 text-xs text-gray-600">
                      <p>Total Chunks: {steps.chunking.totalChunks}</p>
                      <p>Valid Chunks: {steps.chunking.validChunks}</p>
                      <p>Skipped Chunks: {steps.chunking.skippedChunks}</p>
                      <p>Avg Chunk Size: {formatFileSize(steps.chunking.averageChunkSize || 0)}</p>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-red-600">
                      <p>Error: {steps.chunking.error}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Embedding Step */}
              {steps.embedding && (
                <div
                  className={`p-2 rounded ${steps.embedding.successfulEmbeddings > 0 ? "bg-green-50" : "bg-red-50"}`}
                >
                  <div className="flex items-center">
                    {steps.embedding.successfulEmbeddings > 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                    )}
                    <span className="font-medium">Embedding Generation</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    <p>Model: {steps.embedding.embeddingModel}</p>
                    <p>Successful: {steps.embedding.successfulEmbeddings}</p>
                    <p>Failed: {steps.embedding.failedEmbeddings}</p>
                    <p>Vectors Inserted: {steps.embedding.totalVectorsInserted || 0}</p>
                    <p>Batches: {steps.embedding.totalBatches}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timings */}
          {formattedTimings.length > 0 && (
            <div className="mt-3">
              <h5 className="font-medium text-xs uppercase text-gray-500 mb-2">Performance Metrics</h5>
              <div className="grid grid-cols-2 gap-1">
                {formattedTimings.map((timing, index) => (
                  <div key={index} className="text-xs">
                    <span className="text-gray-500">{timing.name}:</span>{" "}
                    <span className="font-mono">{timing.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Content Preview */}
          {steps.fetchContent?.contentPreview && (
            <div className="mt-3">
              <h5 className="font-medium text-xs uppercase text-gray-500 mb-2">Content Preview</h5>
              <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                {steps.fetchContent.contentPreview}
              </div>
            </div>
          )}

          {/* Error Details */}
          {debugInfo.error && (
            <div className="mt-3">
              <h5 className="font-medium text-xs uppercase text-gray-500 mb-2">Error Details</h5>
              <div className="p-2 bg-red-50 rounded border border-red-200 text-xs text-red-700">
                <p className="font-medium">Error Type: {debugInfo.errorType || "Unknown"}</p>
                <p className="mt-1">{debugInfo.error}</p>
                {debugInfo.errorStack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">Stack Trace</summary>
                    <pre className="mt-1 text-xs overflow-x-auto p-1 bg-red-100 rounded">{debugInfo.errorStack}</pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
