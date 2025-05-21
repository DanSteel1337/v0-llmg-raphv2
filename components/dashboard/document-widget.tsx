"use client"

import React from "react"
import { useState, useEffect } from "react"
import {
  Trash2,
  Upload,
  RefreshCw,
  AlertCircle,
  FileText,
  CheckCircle,
  Clock,
  Tag,
  MoreHorizontal,
  X,
  Loader2,
  Plus,
  File,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useDocuments } from "@/hooks/use-documents"
import { formatFileSize, formatDate } from "@/utils/formatting"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import type { Document, DocumentFilterOptions } from "@/types"
import { withErrorHandling, showErrorToast, showSuccessToast } from "@/utils/errorHandling"

/**
 * Document list item component
 * Renders a single document in the list with status and actions
 */
const DocumentListItem = React.memo(
  ({
    document,
    onDelete,
    onRetry,
    onView,
    onTag,
    onSelect,
    isSelected,
  }: {
    document: Document
    onDelete: (id: string) => void
    onRetry: (id: string) => void
    onView: (document: Document) => void
    onTag: (document: Document) => void
    onSelect?: (id: string, selected: boolean) => void
    isSelected?: boolean
  }) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case "processing":
          return "text-amber-600"
        case "indexed":
          return "text-green-600"
        case "failed":
          return "text-red-600"
        default:
          return "text-gray-600"
      }
    }

    const getStatusIcon = (status: string) => {
      switch (status) {
        case "processing":
          return <Clock className="mr-1 h-4 w-4" />
        case "indexed":
          return <CheckCircle className="mr-1 h-4 w-4" />
        case "failed":
          return <AlertCircle className="mr-1 h-4 w-4" />
        default:
          return <FileText className="mr-1 h-4 w-4" />
      }
    }

    return (
      <Card key={document.id} className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center border-b p-4">
            {onSelect && (
              <div className="mr-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelect(document.id, !!checked)}
                  aria-label={`Select ${document.name}`}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium truncate">{document.name}</h3>
                <div className={`flex items-center ${getStatusColor(document.status)}`}>
                  {getStatusIcon(document.status)}
                  <span className="text-xs capitalize">{document.status}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xs text-gray-500">
                  {formatFileSize(document.file_size)} • {formatDate(document.created_at)}
                </p>
                {document.tags && document.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {document.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs py-0 px-1">
                        {tag}
                      </Badge>
                    ))}
                    {document.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs py-0 px-1">
                        +{document.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          {document.status === "processing" && document.processing_progress !== undefined && (
            <Progress value={document.processing_progress} className="h-1 rounded-none" />
          )}
          {document.status === "failed" && document.error_message && (
            <div className="bg-red-50 p-3 text-xs text-red-800">
              <p className="font-medium">Error: {document.error_message}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between p-2">
          <Button variant="ghost" size="sm" onClick={() => onView(document)}>
            <FileText className="mr-1 h-4 w-4" />
            View
          </Button>
          <div className="flex space-x-1">
            {document.status === "failed" && (
              <Button variant="ghost" size="sm" onClick={() => onRetry(document.id)}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Retry
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onTag(document)}>
                  <Tag className="mr-2 h-4 w-4" />
                  Manage Tags
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => onDelete(document.id)}
                  disabled={document.status === "processing"}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardFooter>
      </Card>
    )
  },
)

DocumentListItem.displayName = "DocumentListItem"

/**
 * Document skeleton component for loading state
 */
const DocumentSkeleton = () => (
  <Card className="overflow-hidden">
    <CardContent className="p-0">
      <div className="flex items-center border-b p-4">
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </CardContent>
    <CardFooter className="flex justify-between p-2">
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
    </CardFooter>
  </Card>
)

/**
 * Empty state component when no documents are available
 */
const EmptyDocumentState = ({ onUpload }: { onUpload: () => void }) => (
  <div className="rounded-md bg-gray-50 p-8 text-center">
    <FileText className="mx-auto h-12 w-12 text-gray-400" />
    <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
    <p className="mt-1 text-sm text-gray-500">Upload a document to get started.</p>
    <div className="mt-6">
      <Button onClick={onUpload}>
        <Upload className="mr-2 h-4 w-4" />
        Upload Document
      </Button>
    </div>
  </div>
)

/**
 * Filter dialog component
 */
const FilterDialog = ({
  open,
  onClose,
  filters,
  onApplyFilters,
}: {
  open: boolean
  onClose: () => void
  filters: DocumentFilterOptions
  onApplyFilters: (filters: DocumentFilterOptions) => void
}) => {
  const [localFilters, setLocalFilters] = useState<DocumentFilterOptions>(filters)

  // Reset local filters when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters)
    }
  }, [open, filters])

  const handleApply = () => {
    onApplyFilters(localFilters)
    onClose()
  }

  const handleReset = () => {
    setLocalFilters({})
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Filter Documents</DialogTitle>
          <DialogDescription>Set criteria to filter your documents.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <div className="flex flex-wrap gap-2">
              {["indexed", "processing", "failed"].map((status) => (
                <Badge
                  key={status}
                  variant={localFilters.status === status ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      status: prev.status === status ? undefined : status,
                    }))
                  }
                >
                  {status}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dateRange">Date Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="dateFrom" className="text-xs">
                  From
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={localFilters.dateFrom || ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      dateFrom: e.target.value || undefined,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="dateTo" className="text-xs">
                  To
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={localFilters.dateTo || ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      dateTo: e.target.value || undefined,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              placeholder="Enter tags separated by commas"
              value={localFilters.tags?.join(", ") || ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  tags: e.target.value ? e.target.value.split(",").map((tag) => tag.trim()) : undefined,
                }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleApply}>Apply Filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Tag management dialog component
 */
const TagDialog = ({
  open,
  onClose,
  document,
  onUpdateTags,
}: {
  open: boolean
  onClose: () => void
  document: Document | null
  onUpdateTags: (documentId: string, tags: string[]) => void
}) => {
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  // Reset tags when document changes
  useEffect(() => {
    if (document) {
      setTags(document.tags || [])
    }
  }, [document])

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleSave = () => {
    if (document) {
      onUpdateTags(document.id, tags)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>Add or remove tags for {document?.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add new tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
            />
            <Button onClick={handleAddTag} disabled={!newTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                {tag}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
              </Badge>
            ))}
            {tags.length === 0 && <p className="text-sm text-gray-500">No tags added yet</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Tags</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Error fallback component for DocumentWidget
 */
const DocumentWidgetErrorFallback = () => {
  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-6 text-center">
        <div className="text-red-500 mb-4">
          <File className="h-12 w-12 mx-auto mb-2" />
          <h3 className="text-lg font-semibold">Error Loading Documents</h3>
        </div>
        <p className="mb-4 text-muted-foreground">
          There was a problem loading the document widget. Please try refreshing the page.
        </p>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Main content component for DocumentWidget
 */
const DocumentWidgetContent = () => {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { documents, isLoading, error, fetchDocuments, uploadDocument, deleteDocument } = useDocuments()

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  // Handle file upload with error handling
  const handleUpload = withErrorHandling(
    async () => {
      if (!file) {
        showErrorToast("Please select a file to upload")
        return
      }

      setIsUploading(true)
      try {
        await uploadDocument(file)
        setFile(null)
        showSuccessToast("Document uploaded successfully")
      } finally {
        setIsUploading(false)
      }
    },
    {
      context: { component: "DocumentWidget", action: "upload" },
    },
  )

  // Handle document deletion with error handling
  const handleDelete = withErrorHandling(
    async (id: string) => {
      await deleteDocument(id)
      showSuccessToast("Document deleted successfully")
    },
    {
      context: { component: "DocumentWidget", action: "delete" },
    },
  )

  // Render loading state
  if (isLoading && !documents.length) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading documents...</p>
        </CardContent>
      </Card>
    )
  }

  // Render error state
  if (error && !documents.length) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <div className="text-red-500 mb-4">
            <FileText className="h-12 w-12 mx-auto mb-2" />
            <h3 className="text-lg font-semibold">Error Loading Documents</h3>
          </div>
          <p className="mb-4 text-muted-foreground">{error.message}</p>
          <Button onClick={() => fetchDocuments()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Render main content
  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Input type="file" accept=".txt" onChange={handleFileChange} disabled={isUploading} className="flex-1" />
            <Button onClick={handleUpload} disabled={!file || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
          {file && (
            <p className="mt-1 text-sm text-muted-foreground">
              Selected file: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Documents</h3>
            <p className="text-sm text-muted-foreground mt-1">Upload a document to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{doc.title || doc.file_path.split("/").pop()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(doc.id)}
                  aria-label={`Delete document ${doc.title || doc.file_path}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Document Widget Component
 * Provides a comprehensive interface for document management
 */
function DocumentWidget() {
  return (
    <ErrorBoundary fallback={<DocumentWidgetErrorFallback />}>
      <DocumentWidgetContent />
    </ErrorBoundary>
  )
}

// Add named export alongside default export
export { DocumentWidget }

// Default export
export default DocumentWidget
