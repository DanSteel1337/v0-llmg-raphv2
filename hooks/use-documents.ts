/**
 * Document Management Hook
 *
 * React hook for managing documents in the Vector RAG application.
 * Provides comprehensive functionality for document operations including
 * listing, filtering, uploading, processing, and deletion.
 *
 * Features:
 * - Document listing with filtering, sorting, and pagination
 * - Document upload with progress tracking
 * - Document processing status monitoring
 * - Document deletion with confirmation
 * - Document metadata management (tags, visibility)
 * - Comprehensive error handling with retry logic
 * - Optimistic updates for better user experience
 * - Caching and state management with React Query
 *
 * Dependencies:
 * - @tanstack/react-query for data fetching and caching
 * - @/hooks/use-auth for user session information
 * - @/services/client-api-service for API interactions
 * - @/types for document interfaces
 *
 * @module hooks/use-documents
 */

"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import {
  fetchDocuments,
  uploadDocument as apiUploadDocument,
  deleteDocument as apiDeleteDocument,
  retryDocumentProcessing as apiRetryProcessing,
  updateDocumentMetadata as apiUpdateMetadata,
  searchDocuments as apiSearchDocuments,
} from "@/services/client-api-service"
import type {
  Document,
  DocumentStats,
  DocumentFilterOptions,
  DocumentSortOptions,
  DocumentPaginationOptions,
} from "@/types"

// Query keys for React Query
const DOCUMENTS_QUERY_KEY = "documents"
const DOCUMENT_STATS_QUERY_KEY = "document-stats"

/**
 * Document upload options interface
 */
interface UploadOptions {
  tags?: string[]
  visibility?: "public" | "private" | "shared"
  description?: string
  onProgress?: (progress: number) => void
}

/**
 * Document processing options interface
 */
interface ProcessingOptions {
  onProgress?: (progress: number) => void
  onComplete?: (document: Document) => void
  onError?: (error: Error) => void
}

/**
 * Document search options interface
 */
interface SearchOptions {
  query: string
  filters?: DocumentFilterOptions
  sort?: DocumentSortOptions
  pagination?: DocumentPaginationOptions
}

/**
 * Document batch operation options interface
 */
interface BatchOperationOptions {
  documentIds: string[]
  operation: "delete" | "tag" | "setVisibility"
  metadata?: Record<string, any>
  onProgress?: (completed: number, total: number) => void
}

/**
 * Documents hook return type
 */
interface UseDocumentsReturn {
  // Document data
  documents: Document[]
  filteredDocuments: Document[]
  documentStats: DocumentStats | null
  selectedDocument: Document | null

  // Loading and error states
  isLoading: boolean
  isUploading: boolean
  isProcessing: boolean
  isDeleting: boolean
  error: Error | null

  // Document operations
  uploadDocument: (file: File, options?: UploadOptions) => Promise<Document>
  deleteDocument: (documentId: string, skipConfirmation?: boolean) => Promise<boolean>
  retryProcessing: (documentId: string) => Promise<boolean>
  updateMetadata: (documentId: string, metadata: Record<string, any>) => Promise<Document>
  selectDocument: (documentId: string | null) => void

  // Batch operations
  batchOperation: (options: BatchOperationOptions) => Promise<boolean>

  // Filtering and search
  searchDocuments: (options: SearchOptions) => Promise<Document[]>
  filterDocuments: (filters: DocumentFilterOptions) => void
  sortDocuments: (sort: DocumentSortOptions) => void
  paginateDocuments: (pagination: DocumentPaginationOptions) => void

  // Utility functions
  refreshDocuments: () => Promise<Document[]>
  clearFilters: () => void

  // Filter state
  filters: DocumentFilterOptions
  sort: DocumentSortOptions
  pagination: DocumentPaginationOptions
  totalDocuments: number
  hasMoreDocuments: boolean
}

/**
 * Hook for comprehensive document management functionality
 * @returns Document management methods and state
 */
export function useDocuments(): UseDocumentsReturn {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Document state
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingProgress, setProcessingProgress] = useState<Record<string, number>>({})
  const [error, setError] = useState<Error | null>(null)

  // Filter state with defaults
  const [filters, setFilters] = useState<DocumentFilterOptions>({})
  const [sort, setSort] = useState<DocumentSortOptions>({ field: "createdAt", direction: "desc" })
  const [pagination, setPagination] = useState<DocumentPaginationOptions>({ limit: 10, offset: 0 })
  const [totalDocuments, setTotalDocuments] = useState(0)

  // Refs for tracking active operations
  const activeUploads = useRef<Record<string, AbortController>>({})
  const activeProcessing = useRef<Record<string, AbortController>>({})

  // Fetch documents with React Query
  const documentsQuery: UseQueryResult<{ documents: Document[]; total: number; stats: DocumentStats | null }> =
    useQuery({
      queryKey: [DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination],
      queryFn: async () => {
        if (!user?.id) {
          return { documents: [], total: 0, stats: null }
        }

        try {
          const result = await fetchDocuments(user.id, {
            filters,
            sort,
            pagination,
          })

          return {
            documents: result.documents || [],
            total: result.pagination?.total || 0,
            stats: result.stats || null,
          }
        } catch (err) {
          console.error("Error fetching documents:", err)
          throw err
        }
      },
      enabled: !!user?.id,
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: true,
      refetchInterval: (data) => {
        // Refetch more frequently if we have documents in processing state
        const hasProcessingDocs = data?.documents.some((doc) => doc.status === "processing")
        return hasProcessingDocs ? 5000 : false
      },
    })

  // Extract data from query
  const documents = documentsQuery.data?.documents || []
  const documentStats = documentsQuery.data?.stats || null

  // Compute filtered documents based on current filters
  const filteredDocuments = useMemo(() => {
    return documents
  }, [documents])

  // Compute if there are more documents to load
  const hasMoreDocuments = useMemo(() => {
    return totalDocuments > pagination.offset + pagination.limit
  }, [totalDocuments, pagination])

  // Update total documents when data changes
  useEffect(() => {
    if (documentsQuery.data?.total !== undefined) {
      setTotalDocuments(documentsQuery.data.total)
    }
  }, [documentsQuery.data?.total])

  // Document upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, options }: { file: File; options?: UploadOptions }) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      setIsUploading(true)
      setUploadProgress(0)

      try {
        // Create abort controller for this upload
        const abortController = new AbortController()
        const uploadId = Date.now().toString()
        activeUploads.current[uploadId] = abortController

        // Upload the document with progress tracking
        const newDocument = await apiUploadDocument(
          user.id,
          file,
          (progress) => {
            setUploadProgress(progress)
            options?.onProgress?.(progress)
          },
          {
            signal: abortController.signal,
            tags: options?.tags,
            visibility: options?.visibility,
            description: options?.description,
          },
        )

        // Clean up abort controller
        delete activeUploads.current[uploadId]

        return newDocument
      } catch (err) {
        console.error("Error uploading document:", err)
        throw err
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }
    },
    onSuccess: (newDocument) => {
      // Update document list with the new document
      queryClient.setQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination], (oldData: any) => {
        if (!oldData) return { documents: [newDocument], total: 1, stats: null }

        // Add new document to the list and update total
        return {
          ...oldData,
          documents: [newDocument, ...oldData.documents],
          total: (oldData.total || 0) + 1,
        }
      })

      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_STATS_QUERY_KEY] })
    },
    onError: (err) => {
      console.error("Upload mutation error:", err)
      setError(err instanceof Error ? err : new Error("Failed to upload document"))
    },
  })

  // Document deletion mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        await apiDeleteDocument(documentId)
        return documentId
      } catch (err) {
        console.error("Error deleting document:", err)
        throw err
      }
    },
    onMutate: async (documentId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })

      // Snapshot the previous value
      const previousDocuments = queryClient.getQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination])

      // Optimistically update to the new value
      queryClient.setQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination], (old: any) => {
        if (!old) return { documents: [], total: 0, stats: null }

        return {
          ...old,
          documents: old.documents.filter((doc: Document) => doc.id !== documentId),
          total: Math.max(0, (old.total || 0) - 1),
        }
      })

      // Return a context object with the snapshotted value
      return { previousDocuments }
    },
    onError: (err, documentId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination], context?.previousDocuments)

      setError(err instanceof Error ? err : new Error("Failed to delete document"))
    },
    onSettled: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_STATS_QUERY_KEY] })
    },
  })

  // Document processing retry mutation
  const retryMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        await apiRetryProcessing(documentId)
        return documentId
      } catch (err) {
        console.error("Error retrying document processing:", err)
        throw err
      }
    },
    onMutate: async (documentId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })

      // Snapshot the previous value
      const previousDocuments = queryClient.getQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination])

      // Optimistically update to the new value
      queryClient.setQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination], (old: any) => {
        if (!old) return { documents: [], total: 0, stats: null }

        return {
          ...old,
          documents: old.documents.map((doc: Document) =>
            doc.id === documentId
              ? { ...doc, status: "processing", processing_progress: 0, error_message: undefined }
              : doc,
          ),
        }
      })

      // Return a context object with the snapshotted value
      return { previousDocuments }
    },
    onError: (err, documentId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination], context?.previousDocuments)

      setError(err instanceof Error ? err : new Error("Failed to retry document processing"))
    },
    onSettled: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })
    },
  })

  // Document metadata update mutation
  const updateMetadataMutation = useMutation({
    mutationFn: async ({ documentId, metadata }: { documentId: string; metadata: Record<string, any> }) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        const updatedDocument = await apiUpdateMetadata(documentId, metadata)
        return updatedDocument
      } catch (err) {
        console.error("Error updating document metadata:", err)
        throw err
      }
    },
    onMutate: async ({ documentId, metadata }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })

      // Snapshot the previous value
      const previousDocuments = queryClient.getQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination])

      // Optimistically update to the new value
      queryClient.setQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination], (old: any) => {
        if (!old) return { documents: [], total: 0, stats: null }

        return {
          ...old,
          documents: old.documents.map((doc: Document) =>
            doc.id === documentId ? { ...doc, ...metadata, updated_at: new Date().toISOString() } : doc,
          ),
        }
      })

      // Return a context object with the snapshotted value
      return { previousDocuments }
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData([DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination], context?.previousDocuments)

      setError(err instanceof Error ? err : new Error("Failed to update document metadata"))
    },
    onSettled: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })
    },
  })

  // Batch operation mutation
  const batchMutation = useMutation({
    mutationFn: async (options: BatchOperationOptions) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      const { documentIds, operation, metadata, onProgress } = options

      try {
        // Process each document in the batch
        let completed = 0
        const total = documentIds.length

        for (const documentId of documentIds) {
          // Perform the requested operation
          switch (operation) {
            case "delete":
              await apiDeleteDocument(documentId)
              break
            case "tag":
              await apiUpdateMetadata(documentId, { tags: metadata?.tags })
              break
            case "setVisibility":
              await apiUpdateMetadata(documentId, { visibility: metadata?.visibility })
              break
          }

          // Update progress
          completed++
          onProgress?.(completed, total)
        }

        return true
      } catch (err) {
        console.error(`Error performing batch ${operation}:`, err)
        throw err
      }
    },
    onSettled: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [DOCUMENT_STATS_QUERY_KEY] })
    },
  })

  /**
   * Upload a document with progress tracking
   * @param file File to upload
   * @param options Optional upload options
   * @returns The created document
   */
  const handleUploadDocument = useCallback(
    async (file: File, options?: UploadOptions) => {
      return uploadMutation.mutateAsync({ file, options })
    },
    [uploadMutation],
  )

  /**
   * Delete a document by ID
   * @param documentId Document ID to delete
   * @param skipConfirmation Skip confirmation dialog
   * @returns True if deletion was successful
   */
  const handleDeleteDocument = useCallback(
    async (documentId: string, skipConfirmation = false) => {
      // Confirm deletion unless skipped
      if (!skipConfirmation) {
        const confirmed = window.confirm("Are you sure you want to delete this document? This action cannot be undone.")
        if (!confirmed) {
          return false
        }
      }

      await deleteMutation.mutateAsync(documentId)
      return true
    },
    [deleteMutation],
  )

  /**
   * Retry processing a failed document
   * @param documentId Document ID to retry processing for
   * @returns True if retry was successful
   */
  const handleRetryProcessing = useCallback(
    async (documentId: string) => {
      await retryMutation.mutateAsync(documentId)
      return true
    },
    [retryMutation],
  )

  /**
   * Update document metadata
   * @param documentId Document ID to update
   * @param metadata Metadata to update
   * @returns Updated document
   */
  const handleUpdateMetadata = useCallback(
    async (documentId: string, metadata: Record<string, any>) => {
      return updateMetadataMutation.mutateAsync({ documentId, metadata })
    },
    [updateMetadataMutation],
  )

  /**
   * Perform a batch operation on multiple documents
   * @param options Batch operation options
   * @returns True if operation was successful
   */
  const handleBatchOperation = useCallback(
    async (options: BatchOperationOptions) => {
      return batchMutation.mutateAsync(options)
    },
    [batchMutation],
  )

  /**
   * Search documents with filters
   * @param options Search options
   * @returns Matching documents
   */
  const handleSearchDocuments = useCallback(
    async (options: SearchOptions) => {
      if (!user?.id) {
        throw new Error("User not authenticated")
      }

      try {
        const results = await apiSearchDocuments(user.id, options)
        return results.documents || []
      } catch (err) {
        console.error("Error searching documents:", err)
        throw err
      }
    },
    [user?.id],
  )

  /**
   * Filter documents by criteria
   * @param newFilters Filter criteria
   */
  const handleFilterDocuments = useCallback((newFilters: DocumentFilterOptions) => {
    // Reset pagination when filters change
    setPagination((prev) => ({ ...prev, offset: 0 }))
    setFilters(newFilters)
  }, [])

  /**
   * Sort documents by field and direction
   * @param newSort Sort options
   */
  const handleSortDocuments = useCallback((newSort: DocumentSortOptions) => {
    setSort(newSort)
  }, [])

  /**
   * Paginate documents
   * @param newPagination Pagination options
   */
  const handlePaginateDocuments = useCallback((newPagination: DocumentPaginationOptions) => {
    setPagination(newPagination)
  }, [])

  /**
   * Clear all filters
   */
  const handleClearFilters = useCallback(() => {
    setFilters({})
    setSort({ field: "createdAt", direction: "desc" })
    setPagination({ limit: 10, offset: 0 })
  }, [])

  /**
   * Select a document for detailed view
   * @param documentId Document ID to select, or null to clear selection
   */
  const handleSelectDocument = useCallback(
    (documentId: string | null) => {
      if (!documentId) {
        setSelectedDocument(null)
        return
      }

      const document = documents.find((doc) => doc.id === documentId) || null
      setSelectedDocument(document)
    },
    [documents],
  )

  /**
   * Refresh documents from the API
   * @returns The fetched documents
   */
  const handleRefreshDocuments = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] })
    const data = await queryClient.fetchQuery({
      queryKey: [DOCUMENTS_QUERY_KEY, user?.id, filters, sort, pagination],
      queryFn: async () => {
        if (!user?.id) {
          return { documents: [], total: 0, stats: null }
        }

        const result = await fetchDocuments(user.id, {
          filters,
          sort,
          pagination,
        })

        return {
          documents: result.documents || [],
          total: result.pagination?.total || 0,
          stats: result.stats || null,
        }
      },
    })

    return data.documents || []
  }, [queryClient, user?.id, filters, sort, pagination])

  // Clean up any active operations on unmount
  useEffect(() => {
    return () => {
      // Abort any active uploads
      Object.values(activeUploads.current).forEach((controller) => {
        controller.abort()
      })

      // Abort any active processing
      Object.values(activeProcessing.current).forEach((controller) => {
        controller.abort()
      })
    }
  }, [])

  return {
    // Document data
    documents,
    filteredDocuments,
    documentStats,
    selectedDocument,

    // Loading and error states
    isLoading: documentsQuery.isLoading,
    isUploading,
    isProcessing,
    isDeleting: deleteMutation.isPending,
    error,

    // Document operations
    uploadDocument: handleUploadDocument,
    deleteDocument: handleDeleteDocument,
    retryProcessing: handleRetryProcessing,
    updateMetadata: handleUpdateMetadata,
    selectDocument: handleSelectDocument,

    // Batch operations
    batchOperation: handleBatchOperation,

    // Filtering and search
    searchDocuments: handleSearchDocuments,
    filterDocuments: handleFilterDocuments,
    sortDocuments: handleSortDocuments,
    paginateDocuments: handlePaginateDocuments,

    // Utility functions
    refreshDocuments: handleRefreshDocuments,
    clearFilters: handleClearFilters,

    // Filter state
    filters,
    sort,
    pagination,
    totalDocuments,
    hasMoreDocuments,
  }
}
