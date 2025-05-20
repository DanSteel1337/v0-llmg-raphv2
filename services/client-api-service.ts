/**
 * Client API Service
 *
 * Service layer for client-side API interactions with the backend.
 * Provides standardized methods for handling HTTP requests to all API endpoints.
 *
 * Features:
 * - Document management (upload, retrieve, delete)
 * - Chat conversations and messages
 * - Search functionality
 * - Analytics data retrieval
 * - Health checks
 *
 * Dependencies:
 * - apiCall utility for standardized request handling
 * - Type definitions for proper type safety
 *
 * @module services/client-api-service
 */

import { apiCall } from "./apiCall"
import type { Document, AnalyticsData, Conversation, Message, SearchResult, SearchOptions } from "@/types"
import { ProcessingStep } from "@/constants" // Import from constants.ts

/**
 * Fetch documents for a user
 *
 * @param userId User ID to fetch documents for
 * @returns Array of documents
 */
export async function fetchDocuments(userId: string): Promise<Document[]> {
  try {
    if (!userId) {
      console.error("fetchDocuments called without userId")
      return []
    }

    console.log(`Fetching documents for user ${userId}`)
    const response = await apiCall<{ success: boolean; documents: Document[] }>(
      `/api/documents?userId=${encodeURIComponent(userId)}`,
    )

    if (!response || !response.success || !response.documents) {
      console.warn("Received invalid response from documents API", { response })
      return []
    }

    return Array.isArray(response.documents) ? response.documents : []
  } catch (error) {
    console.error("Error fetching documents:", error)
    throw error
  }
}

/**
 * Get processing step description
 *
 * @param step Processing step
 * @returns Human-readable description of the processing step
 */
export function getProcessingStepDescription(step?: ProcessingStep): string {
  switch (step) {
    case ProcessingStep.INITIALIZING:
      return "Initializing document processing"
    case ProcessingStep.READING_FILE:
      return "Reading file contents"
    case ProcessingStep.CHUNKING:
      return "Splitting document into chunks"
    case ProcessingStep.EMBEDDING:
      return "Generating embeddings"
    case ProcessingStep.INDEXING:
      return "Indexing document in vector database"
    case ProcessingStep.FINALIZING:
      return "Finalizing document processing"
    case ProcessingStep.COMPLETED:
      return "Processing completed"
    case ProcessingStep.FAILED:
      return "Processing failed"
    default:
      return "Processing document"
  }
}

/**
 * Upload a document
 *
 * @param userId User ID who owns the document
 * @param file File to upload
 * @returns Uploaded document metadata
 */
export async function uploadDocument(userId: string, file: File): Promise<Document> {
  try {
    // Validate inputs
    if (!userId) throw new Error("User ID is required")
    if (!file) throw new Error("File is required")

    // Step 1: Create document metadata
    console.log("Creating document metadata...", {
      userId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    const createResponse = await apiCall<{ success: boolean; document: Document }>("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name: file.name,
        fileType: file.type || "text/plain",
        fileSize: file.size,
        filePath: `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
      }),
    })

    // Validate document response
    if (!createResponse.success || !createResponse.document?.id || !createResponse.document?.file_path) {
      console.error("Document creation failed - missing fields:", createResponse)
      throw new Error("Document creation failed: Missing document ID or file path")
    }

    const document = createResponse.document
    console.log("Document metadata created successfully:", {
      documentId: document.id,
      filePath: document.file_path,
    })

    // Step 2: Upload the file content
    console.log("Uploading file content...", {
      documentId: document.id,
      filePath: document.file_path,
    })

    const formData = new FormData()
    formData.append("file", file)
    formData.append("userId", userId)
    formData.append("documentId", document.id)
    formData.append("filePath", document.file_path)

    const uploadResponse = await apiCall<{
      success: boolean
      documentId: string
      fileUrl: string
      blobUrl?: string
    }>("/api/documents/upload", {
      method: "POST",
      body: formData,
    })

    if (!uploadResponse.success) {
      console.error("File upload failed:", uploadResponse)
      throw new Error("File upload failed")
    }

    // Get the file URL (prioritize blobUrl)
    const fileUrl =
      uploadResponse.blobUrl ||
      uploadResponse.fileUrl ||
      `/api/documents/file?path=${encodeURIComponent(document.file_path)}`

    console.log("File uploaded successfully:", {
      documentId: document.id,
      fileUrl,
    })

    // Step 3: Process the document
    console.log("Triggering document processing...", {
      documentId: document.id,
      fileUrl,
    })

    try {
      const processResponse = await apiCall<{ success: boolean; status?: string }>("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          userId,
          filePath: document.file_path,
          fileName: file.name,
          fileType: file.type || "text/plain",
          fileUrl,
        }),
      })

      if (!processResponse.success) {
        throw new Error(processResponse.error || "Document processing failed to start")
      }

      console.log("Document processing triggered:", {
        documentId: document.id,
        status: processResponse.status || "processing",
      })
    } catch (error) {
      console.error("Error triggering document processing:", error)
      throw new Error(
        `Failed to start document processing: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }

    return {
      ...document,
      blob_url: uploadResponse.blobUrl, // Add blob URL to document
    }
  } catch (error) {
    console.error("Document upload pipeline failed:", error)
    throw error
  }
}

/**
 * Upload a document with progress tracking
 *
 * @param userId User ID who owns the document
 * @param file File to upload
 * @param onProgress Optional callback for tracking upload progress
 * @returns Uploaded document metadata
 */
export async function uploadDocumentWithProgress(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<Document> {
  try {
    // Validate inputs
    if (!userId) throw new Error("User ID is required")
    if (!file) throw new Error("File is required")

    // Step 1: Create document metadata
    console.log("Creating document metadata...", {
      userId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    const createResponse = await apiCall<{ success: boolean; document: Document }>("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name: file.name,
        fileType: file.type || "text/plain",
        fileSize: file.size,
        filePath: `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
      }),
    })

    // Validate document response
    if (!createResponse.success || !createResponse.document?.id || !createResponse.document?.file_path) {
      console.error("Document creation failed - missing fields:", createResponse)
      throw new Error("Document creation failed: Missing document ID or file path")
    }

    const document = createResponse.document
    console.log("Document metadata created successfully:", {
      documentId: document.id,
      filePath: document.file_path,
    })

    // Call progress callback with 10% (metadata created)
    if (onProgress) onProgress(10)

    // Step 2: Upload the file content
    console.log("Uploading file content...", {
      documentId: document.id,
      filePath: document.file_path,
    })

    const formData = new FormData()
    formData.append("file", file)
    formData.append("userId", userId)
    formData.append("documentId", document.id)
    formData.append("filePath", document.file_path)

    const uploadResponse = await apiCall<{
      success: boolean
      documentId: string
      fileUrl: string
      blobUrl?: string
    }>("/api/documents/upload", {
      method: "POST",
      body: formData,
    })

    if (!uploadResponse.success) {
      console.error("File upload failed:", uploadResponse)
      throw new Error("File upload failed")
    }

    // Call progress callback with 50% (file uploaded)
    if (onProgress) onProgress(50)

    // Get the file URL (prioritize blobUrl)
    const fileUrl =
      uploadResponse.blobUrl ||
      uploadResponse.fileUrl ||
      `/api/documents/file?path=${encodeURIComponent(document.file_path)}`

    console.log("File uploaded successfully:", {
      documentId: document.id,
      fileUrl,
    })

    // Step 3: Process the document
    console.log("Triggering document processing...", {
      documentId: document.id,
      fileUrl,
    })

    try {
      const processResponse = await apiCall<{ success: boolean; status?: string }>("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          userId,
          filePath: document.file_path,
          fileName: file.name,
          fileType: file.type || "text/plain",
          fileUrl,
        }),
      })

      if (!processResponse.success) {
        throw new Error(processResponse.error || "Document processing failed to start")
      }

      console.log("Document processing triggered:", {
        documentId: document.id,
        status: processResponse.status || "processing",
      })

      // Call progress callback with 75% (processing started)
      if (onProgress) onProgress(75)
    } catch (error) {
      console.error("Error triggering document processing:", error)
      throw new Error(
        `Failed to start document processing: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }

    // Call progress callback with 100% (complete)
    if (onProgress) onProgress(100)

    return {
      ...document,
      blob_url: uploadResponse.blobUrl, // Add blob URL to document
    }
  } catch (error) {
    console.error("Document upload pipeline failed:", error)
    throw error
  }
}

/**
 * Delete a document
 *
 * @param id Document ID to delete
 * @returns Success indicator
 */
export async function deleteDocument(id: string): Promise<{ success: boolean }> {
  if (!id) {
    console.error("deleteDocument called without documentId")
    throw new Error("Document ID is required")
  }

  return await apiCall<{ success: boolean }>(`/api/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

/**
 * Retry document processing
 *
 * @param documentId Document ID to retry processing for
 * @returns Success indicator
 */
export async function retryDocumentProcessing(documentId: string): Promise<{ success: boolean }> {
  if (!documentId) {
    console.error("retryDocumentProcessing called without documentId")
    throw new Error("Document ID is required")
  }

  return await apiCall<{ success: boolean }>("/api/documents/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId }),
  })
}

/**
 * Fetch analytics data
 *
 * @param userId User ID to fetch analytics for
 * @param timeframe Optional timeframe filter
 * @returns Analytics data
 */
export async function fetchAnalytics(userId: string, timeframe?: string): Promise<AnalyticsData> {
  try {
    if (!userId) {
      console.error("fetchAnalytics called without userId")
      return {
        documentCount: 0,
        chunkCount: 0,
        searchCount: 0,
        chatCount: 0,
        topDocuments: [],
        topSearches: [],
      }
    }

    const url = `/api/analytics?userId=${encodeURIComponent(userId)}${timeframe ? `&timeframe=${timeframe}` : ""}`
    const response = await apiCall<AnalyticsData>(url)

    return response
  } catch (error) {
    console.error("Error fetching analytics:", error)
    return {
      documentCount: 0,
      chunkCount: 0,
      searchCount: 0,
      chatCount: 0,
      topDocuments: [],
      topSearches: [],
    }
  }
}

/**
 * Check API health
 *
 * @returns Health status object with service health indicators
 */
export async function checkApiHealth(): Promise<{
  pineconeApiHealthy: boolean | null
  openaiApiHealthy: boolean | null
  errors?: {
    pinecone?: string | null
    openai?: string | null
  }
}> {
  try {
    const response = await apiCall<{
      success: boolean
      status: string
      services: Record<string, boolean>
      errors: {
        pinecone: string | null
        openai: string | null
      }
    }>("/api/health")

    return {
      pineconeApiHealthy: response?.services?.pinecone ?? null,
      openaiApiHealthy: response?.services?.openai ?? null,
      errors: response?.errors,
    }
  } catch (error) {
    console.error("Error checking API health:", error)
    return {
      pineconeApiHealthy: false,
      openaiApiHealthy: false,
      errors: {
        pinecone: error instanceof Error ? error.message : "Unknown error",
        openai: "Connection failed",
      },
    }
  }
}

/**
 * Fetch conversations for a user
 *
 * @param userId User ID to fetch conversations for
 * @returns Array of conversations
 */
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  try {
    if (!userId) {
      console.error("fetchConversations called without userId")
      return []
    }

    const response = await apiCall<{ success: boolean; conversations: Conversation[] }>(
      `/api/conversations?userId=${encodeURIComponent(userId)}`,
    )

    if (!response || !response.success || !response.conversations) {
      console.warn("Received invalid response from conversations API", { response })
      return []
    }

    return Array.isArray(response.conversations) ? response.conversations : []
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return []
  }
}

/**
 * Create a new conversation
 *
 * @param userId User ID who owns the conversation
 * @param title Optional title for the conversation
 * @returns Created conversation
 */
export async function createConversation(userId: string, title?: string): Promise<Conversation | null> {
  try {
    if (!userId) {
      console.error("createConversation called without userId")
      throw new Error("User ID is required")
    }

    const response = await apiCall<{ success: boolean; conversation: Conversation }>("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        title: title || `Conversation ${new Date().toLocaleString()}`,
      }),
    })

    if (!response || !response.success || !response.conversation) {
      console.warn("Received invalid response from create conversation API", { response })
      return null
    }

    return response.conversation
  } catch (error) {
    console.error("Error creating conversation:", error)
    throw error
  }
}

/**
 * Fetch messages for a conversation
 *
 * @param conversationId Conversation ID to fetch messages for
 * @returns Array of messages
 */
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  try {
    if (!conversationId) {
      console.error("fetchMessages called without conversationId")
      return []
    }

    const response = await apiCall<{ success: boolean; messages: Message[] }>(
      `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`,
    )

    if (!response || !response.success || !response.messages) {
      console.warn("Received invalid response from messages API", { response })
      return []
    }

    return Array.isArray(response.messages) ? response.messages : []
  } catch (error) {
    console.error("Error fetching messages:", error)
    return []
  }
}

/**
 * Send a message in a conversation
 *
 * @param conversationId Conversation ID to send message in
 * @param content Message content
 * @param userId User ID sending the message
 * @returns The AI message response
 */
export async function sendMessage(conversationId: string, content: string, userId: string): Promise<Message | null> {
  try {
    if (!conversationId) throw new Error("Conversation ID is required")
    if (!userId) throw new Error("User ID is required")
    if (!content || typeof content !== "string" || content.trim() === "") {
      throw new Error("Message content cannot be empty")
    }

    const response = await apiCall<{ success: boolean; message: Message }>("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        userId,
        content,
      }),
    })

    if (!response || !response.success || !response.message) {
      console.warn("Received invalid response from send message API", { response })
      return null
    }

    return response.message
  } catch (error) {
    console.error("Error sending message:", error)
    throw error
  }
}

/**
 * Perform a search query
 *
 * @param userId User ID performing the search
 * @param query Search query
 * @param options Optional search options
 * @returns Search results
 */
export async function performSearch(
  userId: string,
  query: string,
  options: SearchOptions = { type: "semantic" },
): Promise<SearchResult[]> {
  try {
    if (!userId) throw new Error("User ID is required")
    if (!query) throw new Error("Search query is required")

    // Build search parameters
    const searchParams = new URLSearchParams({
      userId,
      q: query,
    })

    // Add type parameter
    if (options.type) {
      searchParams.append("type", options.type)
    }

    // Add document type filters if present
    if (options.documentTypes && Array.isArray(options.documentTypes)) {
      options.documentTypes.forEach((type) => {
        searchParams.append("documentType", type)
      })
    }

    // Add sort option if present
    if (options.sortBy) {
      searchParams.append("sortBy", options.sortBy)
    }

    // Add date range if present
    if (options.dateRange) {
      if (options.dateRange.from) {
        searchParams.append("from", options.dateRange.from.toISOString())
      }
      if (options.dateRange.to) {
        searchParams.append("to", options.dateRange.to.toISOString())
      }
    }

    const response = await apiCall<{ success: boolean; results: SearchResult[] }>(
      `/api/search?${searchParams.toString()}`,
    )

    if (!response || !response.success) {
      console.warn("Received invalid response from search API", { response })
      return []
    }

    return Array.isArray(response.results) ? response.results : []
  } catch (error) {
    console.error("Error performing search:", error)
    throw error
  }
}

/**
 * Perform a search query (alias for performSearch)
 *
 * @param userId User ID performing the search
 * @param query Search query
 * @param options Optional search options
 * @returns Search results
 */
export async function searchDocuments(
  userId: string,
  query: string,
  options: SearchOptions = { type: "semantic" },
): Promise<SearchResult[]> {
  return performSearch(userId, query, options)
}

/**
 * Fetch recent searches for a user
 *
 * @param userId User ID to fetch recent searches for
 * @param limit Optional limit on number of searches to return
 * @returns Array of recent search queries
 */
export async function getRecentSearches(userId: string, limit = 5): Promise<string[]> {
  try {
    if (!userId) {
      console.error("getRecentSearches called without userId")
      return []
    }

    const response = await apiCall<{ success: boolean; searches: string[] }>(
      `/api/search/recent?userId=${encodeURIComponent(userId)}&limit=${limit}`,
    )

    if (!response || !response.success || !response.searches) {
      console.warn("Received invalid response from recent searches API", { response })
      return []
    }

    return Array.isArray(response.searches) ? response.searches : []
  } catch (error) {
    console.error("Error fetching recent searches:", error)
    return []
  }
}
