"use client"

import type React from "react"

import { useState, useRef } from "react"
import {
  File,
  FileText,
  FilePlus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDocuments } from "@/hooks/use-documents"
import { useAnalytics } from "@/hooks/use-analytics"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"

interface DocumentManagementProps {
  userId: string
}

export function DocumentManagement({ userId }: DocumentManagementProps) {
  const { documents, isLoading, error, uploadDocument, deleteDocument } = useDocuments(userId)
  const { logEvent } = useAnalytics(userId)

  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    // Handle file upload
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true)

    try {
      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        await uploadDocument(file)

        // Log analytics event
        logEvent("document_upload", {
          file_name: file.name,
          file_type: file.name.split(".").pop()?.toUpperCase() || "UNKNOWN",
          file_size: file.size,
        })
      }
    } catch (err) {
      console.error("Error uploading files:", err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id)

      // Log analytics event
      logEvent("document_delete", { document_id: id })
    } catch (err) {
      console.error("Error deleting document:", err)
    }
  }

  const handleDownloadDocument = async (document: any) => {
    try {
      const supabase = getSupabaseBrowserClient()

      const { data, error } = await supabase.storage.from("documents").download(document.file_path)

      if (error) {
        throw error
      }

      // Create a download link
      const url = URL.createObjectURL(data)
      const a = document.createElement("a")
      a.href = url
      a.download = document.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Log analytics event
      logEvent("document_download", { document_id: document.id })
    } catch (err) {
      console.error("Error downloading document:", err)
    }
  }

  const getStatusBadge = (status: string, progress?: number) => {
    switch (status) {
      case "processing":
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
              <Clock className="mr-1 h-3 w-3" />
              Processing {progress !== undefined && `(${progress}%)`}
            </Badge>
            {progress !== undefined && <Progress value={progress} className="h-2 w-16" />}
          </div>
        )
      case "indexed":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="mr-1 h-3 w-3" />
            Indexed
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Document Management</h2>
          <p className="text-muted-foreground">Upload, manage, and organize your documents for RAG processing.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
              <FilePlus className="h-4 w-4" />
              <span>Upload</span>
            </div>
            <Input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
              ref={fileInputRef}
            />
          </Label>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Document Library</CardTitle>
            <CardDescription>Manage your uploaded documents and their processing status.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        <div className="flex justify-center py-4">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-red-500">
                        Error loading documents: {error}
                      </TableCell>
                    </TableRow>
                  ) : documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No documents found. Upload some documents to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {doc.file_type === "PDF" ? (
                              <FileText className="h-4 w-4 text-red-500" />
                            ) : doc.file_type === "DOCX" ? (
                              <FileText className="h-4 w-4 text-blue-500" />
                            ) : (
                              <File className="h-4 w-4" />
                            )}
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell>{doc.file_type}</TableCell>
                        <TableCell>{(doc.file_size / (1024 * 1024)).toFixed(1)} MB</TableCell>
                        <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{getStatusBadge(doc.status, doc.processing_progress)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDownloadDocument(doc)}>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => handleDeleteDocument(doc.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>Drag and drop files or click to upload.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                isDragging ? "border-primary bg-primary/10" : "border-border"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FilePlus className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="mb-2 text-sm font-medium">Drag and drop files here or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports PDF, DOCX, TXT, and other text-based formats</p>
              <Label htmlFor="dropzone-file" className="mt-4 cursor-pointer">
                <div className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  {isUploading ? "Uploading..." : "Select Files"}
                </div>
                <Input
                  id="dropzone-file"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={isUploading}
                />
              </Label>
            </div>

            <div className="mt-6">
              <h4 className="mb-2 text-sm font-medium">Document Statistics</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Documents</span>
                  <span className="font-medium">{documents.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Indexed</span>
                  <span className="font-medium">{documents.filter((d) => d.status === "indexed").length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing</span>
                  <span className="font-medium">{documents.filter((d) => d.status === "processing").length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Failed</span>
                  <span className="font-medium">{documents.filter((d) => d.status === "failed").length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
