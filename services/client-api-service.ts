import type { Document, DocumentStats, Conversation, Message, SearchResult, AnalyticsData } from "@/types"

// Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface DocumentListResponse {
  documents: Document[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  stats?: DocumentStats
}

export interface DocumentResponse {
  document: Document
}

export interface DocumentUploadResponse {
  document: Document
  uploadUrl?: string
}

export interface DocumentProcessingResponse {
  document: Document
  status: "processing" | "indexed" | "failed"
  progress?: number
  error?: string
}

export interface ConversationListResponse {
  conversations: Conversation[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface ConversationResponse {
  conversation: Conversation
}

export interface MessageListResponse {
  messages: Message[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface MessageResponse {
  message: Message
}

export interface SearchResults {
  results: SearchResult[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  query: string
  suggestions?: string[]
  didYouMean?: string
  timeTaken?: number
}

export interface AnalyticsResponse {
  data: AnalyticsData
  timeRange: string
  filters?: Record<string, any>
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy"
  pineconeApiHealthy: boolean
  openaiApiHealthy: boolean
  uptime: number
  version: string
  errors?: {
    pinecone?: string | null
    openai?: string | null
  }
}

// Error Types
export class ClientApiError extends Error {
  statusCode: number
  isNetworkError: boolean
  isTimeoutError: boolean
  isServerError: boolean
  originalError?: any

  constructor(
    message: string,
    options: {
      statusCode?: number
      isNetworkError?: boolean
      isTimeoutError?: boolean
      isServerError?: boolean
      originalError?: any
    } = {},
  ) {
    super(message)
    this.name = "ClientApiError"
    this.statusCode = options.statusCode || 500
    this.isNetworkError = options.isNetworkError || false
    this.isTimeoutError = options.isTimeoutError || false
    this.isServerError = options.isServerError || (options.statusCode ? options.statusCode >= 500 : false)
    this.originalError = options.originalError
  }
}

// Request Options Types
export interface RequestOptions extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
  params?: Record<string, any>
}

// Default request options
const DEFAULT_OPTIONS: RequestOptions = {
  timeout: 30000, // 30 seconds
  retries: 2,
  retryDelay: 1000, // 1 second
}

// Default headers
const DEFAULT_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  Accept: "application/json",
}

/**
 * Builds a URL with query parameters
 * @param endpoint - API endpoint
 * @param params - Query parameters
 * @returns Full URL with query parameters
 */
export function buildUrl(endpoint: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return endpoint
  }

  const url = new URL(endpoint, window.location.origin)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(`${key}[]`, String(item)))
      } else if (typeof value === "object" && value !== null) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue !== undefined && subValue !== null) {
            url.searchParams.append(`${key}[${subKey}]`, String(subValue))
          }
        })
      } else {
        url.searchParams.append(key, String(value))
      }
    }
  })

  return url.toString()
}

/**
 * Creates request options with default values
 * @param method - HTTP method
 * @param data - Request body data
 * @param options - Additional request options
 * @returns Request options
 */
export function createRequestOptions(
  method: string,
  data?: any,
  options: RequestOptions = {},
): RequestInit & { signal?: AbortSignal } {
  const mergedOptions: RequestOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    method,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {}),
    },
  }

  // Don't set content-type for FormData
  if (data instanceof FormData) {
    delete (mergedOptions.headers as any)["Content-Type"]
  }

  // Add body if data is provided
  if (data) {
    if (data instanceof FormData) {
      mergedOptions.body = data
    } else {
      mergedOptions.body = JSON.stringify(data)
    }
  }

  return mergedOptions
}

/**
 * Handles API response with error checking
 * @param response - Fetch Response object
 * @returns Parsed response data
 * @throws ClientApiError if response is not ok
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  // Check if response is ok (status 200-299)
  if (!response.ok) {
    let errorMessage = `Request failed with status: ${response.status}`
    let errorData: any = null

    try {
      errorData = await response.json()
      if (errorData && errorData.error) {
        errorMessage = errorData.error
      }
    } catch (e) {
      // If we can't parse the error response, use the default message
    }

    throw new ClientApiError(errorMessage, {
      statusCode: response.status,
      isServerError: response.status >= 500,
      originalError: errorData,
    })
  }

  // Check for empty response
  const contentType = response.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    const data = await response.json()

    // Check for API error format
    if (data && data.success === false && data.error) {
      throw new ClientApiError(data.error, {
        statusCode: response.status,
        originalError: data,
      })
    }

    return data.data || data
  }

  // For non-JSON responses
  return {} as T
}

/**
 * Executes a fetch request with timeout, retries, and error handling
 * @param url - Request URL
 * @param options - Request options
 * @returns Parsed response data
 * @throws ClientApiError if request fails
 */
export async function fetchWithTimeout<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeout, retries, retryDelay, params, ...fetchOptions } = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const { signal } = controller

  // Set timeout
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeout)

  // Build URL with query parameters
  const fullUrl = buildUrl(url, params)

  // Execute fetch with retries
  let lastError: Error | null = null
  let attempt = 0

  while (attempt <= retries) {
    try {
      const response = await fetch(fullUrl, {
        ...fetchOptions,
        signal,
      })

      clearTimeout(timeoutId)
      return await handleResponse<T>(response)
    } catch (error) {
      lastError = error as Error

      // Don't retry if request was aborted or if we've reached max retries
      if (error instanceof DOMException && error.name === "AbortError") {
        clearTimeout(timeoutId)
        throw new ClientApiError("Request timed out", {
          isTimeoutError: true,
          originalError: error,
        })
      }

      // Don't retry client errors (4xx)
      if (error instanceof ClientApiError && error.statusCode >= 400 && error.statusCode < 500) {
        clearTimeout(timeoutId)
        throw error
      }

      // If we've reached max retries, throw the last error
      if (attempt >= retries) {
        clearTimeout(timeoutId)
        throw error
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
      attempt++
    }
  }

  // This should never happen, but TypeScript requires it
  clearTimeout(timeoutId)
  throw lastError || new ClientApiError("Unknown error occurred")
}

/**
 * Generic API request handler with error transformation
 * @param requestFn - Function that performs the request
 * @returns Response data
 * @throws ClientApiError if request fails
 */
export async function handleApiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await fetchWithTimeout<T>(endpoint, options)
  } catch (error) {
    if (error instanceof ClientApiError) {
      throw error
    }

    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
      throw new ClientApiError("Network error. Please check your connection.", {
        isNetworkError: true,
        originalError: error,
      })
    }

    throw new ClientApiError(error instanceof Error ? error.message : "An unknown error occurred", {
      originalError: error,
    })
  }
}

// Document-related functions

/**
 * Fetches documents with optional filtering and pagination
 * @param userId - User ID
 * @param options - Filter and pagination options
 * @returns Document list response
 */
export async function fetchDocuments(
  userId: string,
  options: {
    filters?: Record<string, any>
    sort?: { field: string; direction: "asc" | "desc" }
    pagination?: { limit: number; offset: number }
  } = {},
): Promise<DocumentListResponse> {
  const { filters = {}, sort, pagination = { limit: 10, offset: 0 } } = options

  const params: Record<string, any> = {
    userId,
    limit: pagination.limit,
    offset: pagination.offset,
    ...filters,
  }

  if (sort) {
    params.sortField = sort.field
    params.sortDirection = sort.direction
  }

  return handleApiRequest<DocumentListResponse>("/api/documents", {
    method: "GET",
    params,
  })
}

/**
 * Fetches a document by ID
 * @param documentId - Document ID
 * @param options - Request options
 * @returns Document response
 */
export async function fetchDocumentById(
  documentId: string,
  options: { includeContent?: boolean; includeMetadata?: boolean } = {},
): Promise<DocumentResponse> {
  return handleApiRequest<DocumentResponse>(`/api/documents/${documentId}`, {
    method: "GET",
    params: options,
  })
}

/**
 * Uploads a document
 * @param userId - User ID
 * @param file - File to upload
 * @param onProgress - Progress callback
 * @param options - Upload options
 * @returns Document upload response
 */
export async function uploadDocument(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void,
  options: {
    signal?: AbortSignal
    tags?: string[]
    visibility?: "public" | "private" | "shared"
    description?: string
  } = {},
): Promise<Document> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("userId", userId)

  if (options.tags) {
    formData.append("tags", JSON.stringify(options.tags))
  }

  if (options.visibility) {
    formData.append("visibility", options.visibility)
  }

  if (options.description) {
    formData.append("description", options.description)
  }

  // If progress tracking is requested, use XMLHttpRequest instead of fetch
  if (onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.open("POST", "/api/documents/upload")

      // Set up progress tracking
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response.data || response)
          } catch (error) {
            reject(
              new ClientApiError("Failed to parse response", {
                statusCode: xhr.status,
                originalError: error,
              }),
            )
          }
        } else {
          let errorMessage = `Upload failed with status: ${xhr.status}`
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            if (errorResponse && errorResponse.error) {
              errorMessage = errorResponse.error
            }
          } catch (e) {
            // If we can't parse the error response, use the default message
          }

          reject(
            new ClientApiError(errorMessage, {
              statusCode: xhr.status,
              isServerError: xhr.status >= 500,
            }),
          )
        }
      })

      // Handle errors
      xhr.addEventListener("error", () => {
        reject(
          new ClientApiError("Network error during upload", {
            isNetworkError: true,
          }),
        )
      })

      xhr.addEventListener("abort", () => {
        reject(
          new ClientApiError("Upload was aborted", {
            statusCode: 0,
          }),
        )
      })

      // Handle timeout
      xhr.addEventListener("timeout", () => {
        reject(
          new ClientApiError("Upload timed out", {
            isTimeoutError: true,
          }),
        )
      })

      // Set timeout
      xhr.timeout = 60000 // 60 seconds

      // Send the request
      xhr.send(formData)

      // Set up abort handling
      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          xhr.abort()
        })
      }
    })
  }

  // Use standard fetch for uploads without progress tracking
  return handleApiRequest<Document>("/api/documents/upload", {
    method: "POST",
    body: formData,
    signal: options.signal,
  })
}

/**
 * Deletes a document
 * @param documentId - Document ID
 * @returns Success status
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  const response = await handleApiRequest<{ success: boolean }>(`/api/documents/${documentId}`, {
    method: "DELETE",
  })

  return response.success
}

/**
 * Retries document processing
 * @param documentId - Document ID
 * @param options - Processing options
 * @returns Document processing response
 */
export async function retryDocumentProcessing(
  documentId: string,
  options: { priority?: "high" | "normal" | "low" } = {},
): Promise<DocumentProcessingResponse> {
  return handleApiRequest<DocumentProcessingResponse>("/api/documents/retry", {
    method: "POST",
    body: {
      documentId,
      ...options,
    },
  })
}

/**
 * Updates document metadata
 * @param documentId - Document ID
 * @param metadata - Metadata to update
 * @returns Updated document
 */
export async function updateDocumentMetadata(documentId: string, metadata: Record<string, any>): Promise<Document> {
  return handleApiRequest<Document>(`/api/documents/${documentId}`, {
    method: "PATCH",
    body: metadata,
  })
}

/**
 * Searches documents
 * @param userId - User ID
 * @param options - Search options
 * @returns Search results
 */
export async function searchDocuments(
  userId: string,
  options: {
    query: string
    mode?: "semantic" | "keyword" | "hybrid"
    filter?: Record<string, any>
    sort?: { field: string; direction: "asc" | "desc" }
    page?: number
    pageSize?: number
    includeHighlights?: boolean
  },
): Promise<SearchResults> {
  const { query, mode = "semantic", filter, sort, page = 1, pageSize = 10, includeHighlights = true } = options

  // Create URL with query parameters
  const params: Record<string, any> = {
    userId,
    query,
    mode,
    page,
    pageSize,
    includeHighlights: includeHighlights.toString(),
  }

  if (sort) {
    params.sortField = sort.field
    params.sortDirection = sort.direction
  }

  // Build request body for filters
  const requestBody: Record<string, any> = { filter: filter || {} }

  return handleApiRequest<SearchResults>("/api/search", {
    method: "POST",
    params,
    body: requestBody,
  })
}

// Conversation-related functions

/**
 * Fetches conversations
 * @param userId - User ID
 * @param options - Filter and pagination options
 * @returns Conversation list response
 */
export async function fetchConversations(
  userId: string,
  options: {
    filters?: Record<string, any>
    pagination?: { limit: number; offset: number }
  } = {},
): Promise<Conversation[]> {
  const { filters = {}, pagination = { limit: 10, offset: 0 } } = options

  const params: Record<string, any> = {
    userId,
    limit: pagination.limit,
    offset: pagination.offset,
    ...filters,
  }

  return handleApiRequest<Conversation[]>("/api/conversations", {
    method: "GET",
    params,
  })
}

/**
 * Creates a new conversation
 * @param userId - User ID
 * @param title - Conversation title
 * @param initialMessage - Optional initial message
 * @returns Created conversation
 */
export async function createConversation(
  userId: string,
  title: string,
  initialMessage?: string,
): Promise<Conversation> {
  return handleApiRequest<Conversation>("/api/conversations", {
    method: "POST",
    body: {
      userId,
      title,
      initialMessage,
    },
  })
}

/**
 * Updates a conversation
 * @param id - Conversation ID
 * @param updates - Updates to apply
 * @returns Updated conversation
 */
export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
  return handleApiRequest<Conversation>(`/api/conversations/${id}`, {
    method: "PATCH",
    body: updates,
  })
}

/**
 * Deletes a conversation
 * @param id - Conversation ID
 * @returns Success status
 */
export async function deleteConversation(id: string): Promise<boolean> {
  const response = await handleApiRequest<{ success: boolean }>(`/api/conversations/${id}`, {
    method: "DELETE",
  })

  return response.success
}

/**
 * Fetches messages for a conversation
 * @param conversationId - Conversation ID
 * @param options - Pagination options
 * @returns Message list
 */
export async function fetchMessages(
  conversationId: string,
  options: {
    limit?: number
    offset?: number
    includeMetadata?: boolean
  } = {},
): Promise<Message[]> {
  const { limit = 50, offset = 0, includeMetadata = false } = options

  return handleApiRequest<Message[]>("/api/chat/messages", {
    method: "GET",
    params: {
      conversationId,
      limit,
      offset,
      includeMetadata: includeMetadata.toString(),
    },
  })
}

/**
 * Sends a message in a conversation
 * @param conversationId - Conversation ID
 * @param content - Message content
 * @param userId - User ID
 * @returns Sent message
 */
export async function sendMessage(conversationId: string, content: string, userId: string): Promise<Message> {
  return handleApiRequest<Message>("/api/chat/messages", {
    method: "POST",
    body: {
      conversationId,
      content,
      userId,
    },
  })
}

// Analytics-related functions

/**
 * Fetches analytics data
 * @param params - Analytics parameters
 * @returns Analytics data
 */
export async function fetchAnalytics(params: Record<string, string> = {}): Promise<AnalyticsData> {
  return handleApiRequest<AnalyticsData>("/api/analytics", {
    method: "GET",
    params,
  })
}

/**
 * Checks API health
 * @returns Health check result
 */
export async function checkApiHealth(): Promise<HealthCheckResult> {
  return handleApiRequest<HealthCheckResult>("/api/health", {
    method: "GET",
  })
}

// Additional utility functions

/**
 * Generates a pre-signed URL for direct file upload
 * @param fileName - File name
 * @param fileType - File MIME type
 * @param userId - User ID
 * @returns Pre-signed URL and upload ID
 */
export async function getUploadUrl(
  fileName: string,
  fileType: string,
  userId: string,
): Promise<{ uploadUrl: string; uploadId: string }> {
  return handleApiRequest<{ uploadUrl: string; uploadId: string }>("/api/documents/upload-url", {
    method: "POST",
    body: {
      fileName,
      fileType,
      userId,
    },
  })
}

/**
 * Completes a direct upload
 * @param uploadId - Upload ID
 * @param userId - User ID
 * @param metadata - Document metadata
 * @returns Document
 */
export async function completeUpload(
  uploadId: string,
  userId: string,
  metadata: Record<string, any> = {},
): Promise<Document> {
  return handleApiRequest<Document>("/api/documents/complete-upload", {
    method: "POST",
    body: {
      uploadId,
      userId,
      metadata,
    },
  })
}

/**
 * Fetches document processing status
 * @param documentId - Document ID
 * @returns Document processing status
 */
export async function getDocumentProcessingStatus(documentId: string): Promise<DocumentProcessingResponse> {
  return handleApiRequest<DocumentProcessingResponse>(`/api/documents/${documentId}/status`, {
    method: "GET",
  })
}

/**
 * Exports document data
 * @param documentId - Document ID
 * @param format - Export format
 * @returns Export URL
 */
export async function exportDocument(
  documentId: string,
  format: "json" | "csv" | "txt" = "json",
): Promise<{ exportUrl: string }> {
  return handleApiRequest<{ exportUrl: string }>(`/api/documents/${documentId}/export`, {
    method: "GET",
    params: { format },
  })
}

/**
 * Fetches similar documents
 * @param documentId - Document ID
 * @param limit - Maximum number of results
 * @returns Similar documents
 */
export async function getSimilarDocuments(documentId: string, limit = 5): Promise<Document[]> {
  return handleApiRequest<Document[]>(`/api/documents/${documentId}/similar`, {
    method: "GET",
    params: { limit },
  })
}

/**
 * Submits feedback on search results
 * @param searchId - Search ID
 * @param resultId - Result ID
 * @param feedback - Feedback type
 * @param userId - User ID
 * @param comments - Optional comments
 * @returns Success status
 */
export async function submitSearchFeedback(
  searchId: string,
  resultId: string,
  feedback: "relevant" | "not_relevant" | "partially_relevant",
  userId: string,
  comments?: string,
): Promise<{ success: boolean }> {
  return handleApiRequest<{ success: boolean }>("/api/search/feedback", {
    method: "POST",
    body: {
      searchId,
      resultId,
      feedback,
      userId,
      comments,
    },
  })
}
