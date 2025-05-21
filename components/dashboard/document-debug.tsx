/**
 * Document Debug Component
 *
 * A debugging tool for visualizing and testing document processing in the serverless RAG system.
 * Provides detailed information about documents, chunks, and processing status.
 *
 * Features:
 * - Document metadata visualization
 * - Chunk inspection and boundaries
 * - Processing status and history
 * - Testing tools for document operations
 * - Diagnostic information and error details
 *
 * @module components/dashboard/document-debug
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import {
  AlertTriangle,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  Copy,
  Search,
  BarChart2,
  Eye,
  Download,
} from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Document } from "@/types"

/**
 * Format date for display
 */
function formatDate(dateString?: string): string {
  if (!dateString) return "N/A"

  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date)
  } catch (error) {
    return dateString
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return "N/A"

  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Document Debug Props Interface
 */
interface DocumentDebugProps {
  document: Document
  onRetry?: (documentId: string) => Promise<void>
}

/**
 * Document Debug Component
 */
export function DocumentDebug({ document, onRetry }: DocumentDebugProps) {
  // State
  const [loading, setLoading] = useState<boolean>(false)
  const [fileContent, setFileContent] = useState<string>("")
  const [showFullContent, setShowFullContent] = useState<boolean>(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("overview")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchResults, setSearchResults] = useState<Array<{ text: string; index: number }>>([])
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted")

  const { toast } = useToast()

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
      toast({
        title: "Processing restarted",
        description: "Document processing has been restarted.",
      })
    } catch (error) {
      console.error("Error retrying document processing:", error)
      toast({
        title: "Retry failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
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

  // Handle search in document content
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || !fileContent) {
      setSearchResults([])
      return
    }

    const query = searchQuery.toLowerCase()
    const results: Array<{ text: string; index: number }> = []

    let index = 0
    let position = fileContent.toLowerCase().indexOf(query, index)

    while (position !== -1 && results.length < 20) {
      // Get context around the match (50 chars before and after)
      const start = Math.max(0, position - 50)
      const end = Math.min(fileContent.length, position + query.length + 50)
      const text = fileContent.substring(start, end)

      results.push({
        text,
        index: position,
      })

      index = position + query.length
      position = fileContent.toLowerCase().indexOf(query, index)
    }

    setSearchResults(results)
  }, [searchQuery, fileContent])

  // Copy to clipboard function
  const copyToClipboard = useCallback(
    (text: string, label: string) => {
      navigator.clipboard.writeText(text).then(
        () => {
          toast({
            title: "Copied to clipboard",
            description: `${label} has been copied to clipboard.`,
          })
        },
        (err) => {
          console.error("Could not copy text: ", err)
          toast({
            title: "Copy failed",
            description: "Failed to copy to clipboard.",
            variant: "destructive",
          })
        },
      )
    },
    [toast],
  )

  // Export document data as JSON
  const exportDocumentData = useCallback(() => {
    try {
      const dataStr = JSON.stringify(document, null, 2)
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`

      const exportFileDefaultName = `document-${document.id}.json`

      const linkElement = document.createElement("a")
      linkElement.setAttribute("href", dataUri)
      linkElement.setAttribute("download", exportFileDefaultName)
      linkElement.click()

      toast({
        title: "Export successful",
        description: "Document data has been exported as JSON.",
      })
    } catch (error) {
      console.error("Error exporting document data:", error)
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    }
  }, [document, toast])

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

  // Get chunks preview
  const getChunksPreview = () => {
    const chunks = processingSteps.chunking?.chunkSizes || []

    if (!chunks.length) {
      return <div className="text-gray-500 italic">No chunk information available</div>
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Chunks ({chunks.length})</h4>
          <div className="text-xs text-gray-500">
            Avg size: {formatFileSize(processingSteps.chunking?.averageChunkSize)}
          </div>
        </div>

        <div className="space-y-2">
          {chunks.map((size: number, index: number) => (
            <div
              key={index}
              className={`border rounded-md p-2 ${selectedChunk === index ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
              onClick={() => setSelectedChunk(selectedChunk === index ? null : index)}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">Chunk {index + 1}</div>
                <div className="text-xs text-gray-500">{formatFileSize(size)}</div>
              </div>
              {selectedChunk === index && (
                <div className="mt-2 text-xs">
                  <div className="bg-gray-100 p-2 rounded">
                    {/* This would ideally show the actual chunk content */}
                    <p className="italic text-gray-500">Chunk content would be displayed here if available</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Get processing timeline
  const getProcessingTimeline = () => {
    if (!debugInfo.processingStartTime) {
      return <div className="text-gray-500 italic">No processing timeline available</div>
    }

    const steps = [
      {
        name: "Start",
        time: debugInfo.processingStartTime,
        status: "complete",
      },
      {
        name: "Content Fetch",
        time: timings.fetchContentTime
          ? new Date(new Date(debugInfo.processingStartTime).getTime() + timings.fetchContentTime).toISOString()
          : undefined,
        status: processingSteps.fetchContent?.success ? "complete" : "failed",
        duration: timings.fetchContentTime ? `${(timings.fetchContentTime / 1000).toFixed(2)}s` : undefined,
      },
      {
        name: "Chunking",
        time: timings.chunkingTime
          ? new Date(
              new Date(debugInfo.processingStartTime).getTime() +
                (timings.fetchContentTime || 0) +
                timings.chunkingTime,
            ).toISOString()
          : undefined,
        status: processingSteps.chunking?.totalChunks > 0 ? "complete" : "failed",
        duration: timings.chunkingTime ? `${(timings.chunkingTime / 1000).toFixed(2)}s` : undefined,
      },
      {
        name: "Embedding",
        time: timings.embeddingTime
          ? new Date(
              new Date(debugInfo.processingStartTime).getTime() +
                (timings.fetchContentTime || 0) +
                (timings.chunkingTime || 0) +
                timings.embeddingTime,
            ).toISOString()
          : undefined,
        status: processingSteps.embedding?.successfulEmbeddings > 0 ? "complete" : "failed",
        duration: timings.embeddingTime ? `${(timings.embeddingTime / 1000).toFixed(2)}s` : undefined,
      },
      {
        name: "Storage",
        time: timings.storageTime
          ? new Date(
              new Date(debugInfo.processingStartTime).getTime() +
                (timings.fetchContentTime || 0) +
                (timings.chunkingTime || 0) +
                (timings.embeddingTime || 0) +
                timings.storageTime,
            ).toISOString()
          : undefined,
        status: processingSteps.storage?.totalVectorsInserted > 0 ? "complete" : "failed",
        duration: timings.storageTime ? `${(timings.storageTime / 1000).toFixed(2)}s` : undefined,
      },
      {
        name: "Complete",
        time: debugInfo.processingEndTime,
        status: document.status === "indexed" ? "complete" : "failed",
      },
    ]

    return (
      <div className="space-y-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-5 bottom-5 w-0.5 bg-gray-200"></div>

          {/* Timeline steps */}
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="relative flex items-start">
                <div
                  className={`absolute left-3 w-3 h-3 rounded-full mt-1.5 -ml-1.5 
                  ${
                    step.status === "complete"
                      ? "bg-green-500"
                      : step.status === "failed"
                        ? "bg-red-500"
                        : step.time
                          ? "bg-blue-500"
                          : "bg-gray-300"
                  }`}
                ></div>
                <div className="ml-6">
                  <h4 className="text-sm font-medium">{step.name}</h4>
                  {step.time && <p className="text-xs text-gray-500">{formatDate(step.time)}</p>}
                  {step.duration && <p className="text-xs text-gray-500">Duration: {step.duration}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {debugInfo.totalDuration && (
          <div className="text-sm mt-4">
            <span className="font-medium">Total Processing Time:</span> {(debugInfo.totalDuration / 1000).toFixed(2)}{" "}
            seconds
          </div>
        )}
      </div>
    )
  }

  // Render document debug component
  return (
    <DashboardCard
      title="Document Debug"
      description="Detailed information about document processing"
      icon={<FileText className="h-5 w-5 text-gray-500" />}
      actions={
        document.status === "failed" && onRetry ? (
          <Button variant="outline" size="sm" onClick={handleRetry} disabled={loading} className="flex items-center">
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1" /> Retry Processing
              </>
            )}
          </Button>
        ) : null
      }
      expandable
      refreshable={!!onRetry}
      onRefresh={handleRetry}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="chunks">Chunks</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Basic Information</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="font-medium">ID:</span> <span className="font-mono">{document.id}</span>
                <button
                  onClick={() => copyToClipboard(document.id, "Document ID")}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                  aria-label="Copy ID to clipboard"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                <Badge
                  variant={
                    document.status === "indexed"
                      ? "success"
                      : document.status === "processing"
                        ? "default"
                        : "destructive"
                  }
                >
                  {document.status}
                </Badge>
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
              {document.embedding_model && (
                <div className="col-span-2">
                  <span className="font-medium">Embedding Model:</span> {document.embedding_model}
                </div>
              )}
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

          {/* Processing Summary */}
          {document.status === "indexed" && processingSteps.chunking && processingSteps.embedding && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center">
                <BarChart2 className="h-4 w-4 text-gray-500 mr-1" /> Processing Summary
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="font-medium mb-1">Chunking</div>
                  <div>Total Chunks: {processingSteps.chunking.totalChunks}</div>
                  <div>Valid Chunks: {processingSteps.chunking.validChunks}</div>
                  <div>Skipped: {processingSteps.chunking.skippedChunks}</div>
                  {processingSteps.chunking.averageChunkSize && (
                    <div>Avg Size: {formatFileSize(processingSteps.chunking.averageChunkSize)}</div>
                  )}
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="font-medium mb-1">Embedding</div>
                  <div>Model: {processingSteps.embedding.embeddingModel || "Unknown"}</div>
                  <div>Successful: {processingSteps.embedding.successfulEmbeddings}</div>
                  <div>Failed: {processingSteps.embedding.failedEmbeddings}</div>
                  <div>Vectors: {processingSteps.embedding.totalVectorsInserted || 0}</div>
                </div>
              </div>
            </div>
          )}

          {/* Processing Progress */}
          {document.status === "processing" && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center">
                <Clock className="h-4 w-4 text-blue-500 mr-1" /> Processing Progress
              </h4>
              <Progress value={document.processing_progress || 0} className="h-2" />
              <div className="text-xs text-gray-500 text-right">{document.processing_progress || 0}% Complete</div>
            </div>
          )}

          {/* File Content Preview */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center">
              <FileText className="h-4 w-4 text-gray-500 mr-1" /> File Content Preview
            </h4>
            {getFilePreview()}
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Input
              placeholder="Search in document content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSearch} size="sm">
              <Search className="h-4 w-4 mr-1" /> Search
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Search Results ({searchResults.length})</h4>
              <div className="space-y-2">
                {searchResults.map((result, index) => (
                  <div key={index} className="bg-yellow-50 p-2 rounded-md text-xs">
                    <div className="font-medium mb-1">Match at position {result.index}</div>
                    <div className="whitespace-pre-wrap">
                      {result.text.replace(
                        new RegExp(searchQuery, "gi"),
                        (match) => `<mark class="bg-yellow-200">${match}</mark>`,
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border rounded-md">
            <div className="flex items-center justify-between p-2 border-b">
              <h4 className="text-sm font-medium">Document Content</h4>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(fileContent, "Document content")}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowFullContent(!showFullContent)}>
                  <Eye className="h-4 w-4 mr-1" /> {showFullContent ? "Show Less" : "Show Full"}
                </Button>
              </div>
            </div>
            <div className="p-2">
              {fileError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 inline-block mr-1" />
                  Error loading file: {fileError}
                </div>
              ) : !fileContent ? (
                <div className="text-gray-500 italic p-4">File content not available</div>
              ) : (
                <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto max-h-[500px] whitespace-pre-wrap">
                  {showFullContent
                    ? fileContent
                    : fileContent.slice(0, 2000) + (fileContent.length > 2000 ? "..." : "")}
                </pre>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="chunks" className="space-y-4">
          {processingSteps.chunking ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium">Chunk Information</h4>
                <div className="text-xs text-gray-500">Strategy: {processingSteps.chunking.strategy || "default"}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium mb-2">Chunking Stats</div>
                  <div className="text-xs space-y-1">
                    <div>Total Chunks: {processingSteps.chunking.totalChunks}</div>
                    <div>Valid Chunks: {processingSteps.chunking.validChunks}</div>
                    <div>Skipped Chunks: {processingSteps.chunking.skippedChunks}</div>
                    {processingSteps.chunking.averageChunkSize && (
                      <div>Avg Chunk Size: {formatFileSize(processingSteps.chunking.averageChunkSize)}</div>
                    )}
                    {timings.chunkingTime && <div>Processing Time: {(timings.chunkingTime / 1000).toFixed(2)}s</div>}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm font-medium mb-2">Embedding Stats</div>
                  <div className="text-xs space-y-1">
                    <div>Model: {processingSteps.embedding?.embeddingModel || "Unknown"}</div>
                    <div>Successful: {processingSteps.embedding?.successfulEmbeddings || 0}</div>
                    <div>Failed: {processingSteps.embedding?.failedEmbeddings || 0}</div>
                    <div>Vectors Inserted: {processingSteps.embedding?.totalVectorsInserted || 0}</div>
                    {timings.embeddingTime && <div>Processing Time: {(timings.embeddingTime / 1000).toFixed(2)}s</div>}
                  </div>
                </div>
              </div>

              {getChunksPreview()}
            </>
          ) : (
            <div className="text-gray-500 italic p-4">No chunk information available for this document</div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          {debugInfo.processingStartTime ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium">Processing Timeline</h4>
                {document.status === "indexed" ? (
                  <Badge variant="success">Completed</Badge>
                ) : document.status === "processing" ? (
                  <Badge>In Progress</Badge>
                ) : (
                  <Badge variant="destructive">Failed</Badge>
                )}
              </div>

              {getProcessingTimeline()}
            </>
          ) : (
            <div className="text-gray-500 italic p-4">No processing timeline available for this document</div>
          )}
        </TabsContent>

        <TabsContent value="raw" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium">Raw Document Data</h4>
            <div className="flex items-center space-x-2">
              <Select value={viewMode} onValueChange={(value: "formatted" | "raw") => setViewMode(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="View Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formatted">Formatted</SelectItem>
                  <SelectItem value="raw">Raw</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(JSON.stringify(document, null, 2), "Document data")}
              >
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>

              <Button variant="outline" size="sm" onClick={exportDocumentData}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </div>
          </div>

          <div className="border rounded-md">
            <div className="p-2">
              <pre
                className={`${viewMode === "formatted" ? "bg-gray-50" : "bg-gray-900 text-gray-100"} p-3 rounded-md text-xs overflow-auto max-h-[500px]`}
              >
                {viewMode === "formatted" ? JSON.stringify(document, null, 2) : JSON.stringify(document)}
              </pre>
            </div>
          </div>

          {debugInfo && Object.keys(debugInfo).length > 0 && (
            <Accordion type="single" collapsible className="mt-4">
              <AccordionItem value="debug-info">
                <AccordionTrigger className="text-sm font-medium">Debug Information</AccordionTrigger>
                <AccordionContent>
                  <pre
                    className={`${viewMode === "formatted" ? "bg-gray-50" : "bg-gray-900 text-gray-100"} p-3 rounded-md text-xs overflow-auto max-h-[300px]`}
                  >
                    {viewMode === "formatted" ? JSON.stringify(debugInfo, null, 2) : JSON.stringify(debugInfo)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </TabsContent>
      </Tabs>
    </DashboardCard>
  )
}
