"use client"

import type React from "react"

import { useState, useCallback, useRef, useEffect } from "react"
import { Trash2, Upload, RefreshCw, AlertCircle, FileText, CheckCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { useDocuments } from "@/hooks/use-documents"
import { formatFileSize, formatDate } from "@/utils/formatting"
import { DashboardCard } from "@/components/ui/dashboard-card"
import type { Document } from "@/types"

export function DocumentWidget() {
  const { documents, isLoading, error, uploadDocument, deleteDocument, retryProcessing, handleRefreshDocuments } =
    useDocuments()
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stalledDocuments, setStalledDocuments] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Check for documents stuck at 0% for more than 30 seconds
    const stalledIds = new Set<string>()
    const now = Date.now()

    documents.forEach((doc) => {
      if (
        doc.status === "processing" &&
        doc.processing_progress === 0 &&
        new Date(doc.updated_at).getTime() < now - 30000
      ) {
        stalledIds.add(doc.id)
      }
    })

    setStalledDocuments(stalledIds)

    // Check every 10 seconds
    const interval = setInterval(() => {
      if (documents.some((doc) => doc.status === "processing")) {
        handleRefreshDocuments()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [documents, handleRefreshDocuments])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Validate file type - only accept text files for now
      if (!file.type.includes("text/")) {
        toast({
          title: "Invalid file type",
          description: "Only text files are supported at this time.",
          variant: "destructive",
        })
        return
      }

      // Validate file size - max 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB.",
          variant: "destructive",
        })
        return
      }

      setIsUploading(true)
      setUploadProgress(0)

      try {
        await uploadDocument(file, (progress) => {
          setUploadProgress(progress)
        })

        toast({
          title: "Document uploaded",
          description: "Your document has been uploaded and is being processed.",
        })
      } catch (error) {
        console.error("Error uploading document:", error)
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive",
        })
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [uploadDocument, toast],
  )

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await deleteDocument(documentId)
        toast({
          title: "Document deleted",
          description: "The document has been removed from your library.",
        })
      } catch (error) {
        console.error("Error deleting document:", error)
        toast({
          title: "Delete failed",
          description: error instanceof Error ? error.message : "An unknown error occurred",
          variant: "destructive",
        })
      }
    },
    [deleteDocument, toast],
  )

  const handleRetryProcessing = useCallback(
    async (documentId: string) => {
      try {
        await retryProcessing(documentId)
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
      }
    },
    [retryProcessing, toast],
  )

  const handleViewDocument = useCallback((document: Document) => {
    // Check if document has a blob_url property
    const fileUrl = document.blob_url || `/api/documents/file?path=${encodeURIComponent(document.file_path)}`
    window.open(fileUrl, "_blank")
  }, [])

  return (
    <DashboardCard>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Documents</CardTitle>
        <CardDescription>Upload and manage your documents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".txt,.md,.csv"
            />
          </div>
          {isUploading && (
            <div className="mt-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="mt-1 text-xs text-gray-500">Uploading and processing: {uploadProgress}%</p>
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
                <Card key={doc.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b p-4">
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="ml-2 h-6 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRetryProcessing(doc.id)
                                  }}
                                >
                                  <RefreshCw className="mr-1 h-3 w-3" />
                                  Restart
                                </Button>
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
                    {doc.status === "processing" && doc.processing_progress !== undefined && (
                      <Progress value={doc.processing_progress} className="h-1 rounded-none" />
                    )}
                    {doc.status === "failed" && doc.error_message && (
                      <div className="bg-red-50 p-3 text-xs text-red-800">
                        <p className="font-medium">Error: {doc.error_message}</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between p-2">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDocument(doc)}>
                      <FileText className="mr-1 h-4 w-4" />
                      View
                    </Button>
                    <div className="flex space-x-1">
                      {doc.status === "failed" && (
                        <Button variant="ghost" size="sm" onClick={() => handleRetryProcessing(doc.id)}>
                          <RefreshCw className="mr-1 h-4 w-4" />
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-100 hover:text-red-700"
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={doc.status === "processing"}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        )}
      </CardContent>
    </DashboardCard>
  )
}
