/**
 * Client API Service
 *
 * Client-side abstraction for API calls to handle document management and other operations.
 * Handles metadata creation, file upload, and triggers processing pipeline.
 *
 * Dependencies:
 * - ./apiCall for standardized API request formatting
 */

import { apiCall } from "./apiCall"
import type { Document, AnalyticsData, Conversation, Message, SearchResult } from "@/types"

/**
 * Fetch documents for a user
 * @param userId The user's unique identifier
 * @returns Array of document metadata objects
 */
export async function fetchDocuments(userId: string): Promise<Document[]> {
  try {
    const response = await apiCall<{ documents: Document[] }>(`/api/documents?userId=${userId}`)
    return Array.isArray(response.documents) ? response.documents : []
  } catch (error) {
    console.error("Error fetching documents:", error)
    throw error
  }
}

/**
 * Upload a document to the system
 * Implements a three-step process:
 * 1. Create document metadata
 * 2. Upload file content
 * 3. Trigger processing pipeline
 *
 * @param userId User ID for document ownership
 * @param file File object to upload
 * @param onProgress Optional progress callback for monitoring
 * @returns Document metadata object
 */
export async function uploadDocument(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<Document> {
  try {
    // Step 1: Create document metadata
    console.log("Creating document metadata...", {
      userId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    const createResponse = await apiCall<{ document: Document }>("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name: file.name,
        fileType: file.type,
        fileSize: file.size,
        filePath: `${userId}/${Date.now()}-${file.name}`,
      }),
    })

    // Validate document response
    const document = createResponse?.document
    if (!document?.id || !document?.file_path) {
      console.error("Document creation failed - missing fields:", document)
      throw new Error("Document creation failed: Missing document ID or file path")
    }

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

    const uploadResponse = await apiCall<{ success: boolean; fileUrl: string }>("/api/documents/upload", {
      method: "POST",
      body: formData,
    })

    if (!uploadResponse?.success) {
      console.error("File upload failed:", uploadResponse)
      throw new Error("File upload failed")
    }

    const fileUrl = uploadResponse.fileUrl || `/api/documents/file?path=${encodeURIComponent(document.file_path)}`

    console.log("File uploaded successfully:", {
      documentId: document.id,
      filePath: document.file_path,
      fileUrl,
    })

    // Step 3: Process the document
    console.log("Triggering document processing...", {
      documentId: document.id,
      filePath: document.file_path,
      fileUrl,
    })

    const processResponse = await apiCall<{ success: boolean }>("/api/documents/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: document.id,
        userId,
        filePath: document.file_path,
        fileName: file.name,
        fileType: file.type,
        fileUrl,
      }),
    })

    if (!processResponse?.success) {
      console.error("Document processing failed to start:", processResponse)
      throw new Error("Failed to start document processing")
    }

    console.log("Document processing triggered:", {
      documentId: document.id,
      filePath: document.file_path,
      fileUrl,
    })

    // Poll for document status updates if progress callback provided
    if (onProgress) {
      const pollInterval = setInterval(async () => {
        try {
          const documents = await fetchDocuments(userId)
          const updatedDocument = documents.find((d) => d.id === document.id)

          if (updatedDocument) {
            if (updatedDocument.status === "indexed" || updatedDocument.status === "failed") {
              clearInterval(pollInterval)
              onProgress(updatedDocument.status === "indexed" ? 100 : 0)
              console.log("Document processing completed:", {
                documentId: document.id,
                status: updatedDocument.status,
                message: updatedDocument.error_message || "Success",
              })
            } else if (updatedDocument.processing_progress !== undefined) {
              onProgress(updatedDocument.processing_progress)
              console.log("Document processing progress:", {
                documentId: document.id,
                progress: updatedDocument.processing_progress,
              })
            }
          }
        } catch (error) {
          console.error("Error polling document status:", error)
        }
      }, 2000)

      // Clean up interval after 5 minutes (max processing time)
      setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000)
    }

    return document
  } catch (error) {
    console.error("Document upload pipeline failed:", error)
    throw error
  }
}

/**
 * Delete a document from the system
 * @param documentId Document ID to delete
 * @returns Success response
 */
export async function deleteDocument(documentId: string): Promise<{ success: boolean }> {
  return await apiCall<{ success: boolean }>(`/api/documents/${documentId}`, {
    method: "DELETE",
  })
}

/**
 * Fetch analytics data for a user
 * @param userId User ID for analytics
 * @param timeRange Optional time range filter
 * @returns Analytics data object
 */
export async function fetchAnalytics(userId: string, timeRange = "7d"): Promise<AnalyticsData> {
  return await apiCall<AnalyticsData>(`/api/analytics?userId=${userId}&timeRange=${timeRange}`)
}

/**
 * Check API health status for services
 * @returns Health status object with detailed error information
 */
export async function checkApiHealth(): Promise<{
  pineconeApiHealthy: boolean
  openaiApiHealthy: boolean
  errors?: {
    pinecone?: string | null
    openai?: string | null
  }
}> {
  try {
    const response = await apiCall<{
      status: string
      services: Record<string, boolean>
      errors?: {
        pinecone?: string | null
        openai?: string | null
      }
    }>("/api/health")

    // Log the full response for debugging
    console.log("Health check response:", response)

    return {
      pineconeApiHealthy: response?.services?.pinecone || false,
      openaiApiHealthy: response?.services?.openai || false,
      errors: response?.errors || {},
    }
  } catch (error) {
    // Log the error for debugging
    console.error("Error checking API health:", error)

    // Return detailed error information
    return {
      pineconeApiHealthy: false,
      openaiApiHealthy: false,
      errors: {
        pinecone: error instanceof Error ? error.message : "Failed to connect to health check endpoint",
        openai: error instanceof Error ? error.message : "Failed to connect to health check endpoint",
      },
    }
  }
}

/**
 * Fetch conversations for a user
 * @param userId User ID
 * @returns Array of conversation objects
 */
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const response = await apiCall<{ conversations: Conversation[] }>(`/api/conversations?userId=${userId}`)
  return Array.isArray(response.conversations) ? response.conversations : []
}

/**
 * Create a new conversation
 * @param userId User ID
 * @param title Conversation title
 * @returns New conversation object
 */
export async function createConversation(userId: string, title: string): Promise<Conversation> {
  const response = await apiCall<{ conversation: Conversation }>("/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, title }),
  })

  return response.conversation
}

/**
 * Fetch messages for a conversation
 * @param conversationId Conversation ID
 * @returns Array of message objects
 */
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const response = await apiCall<{ messages: Message[] }>(`/api/chat/messages?conversationId=${conversationId}`)
  return Array.isArray(response.messages) ? response.messages : []
}

/**
 * Send a message in a conversation
 * @param conversationId Conversation ID
 * @param content Message content
 * @param userId User ID
 * @returns Created message object
 */
export async function sendMessage(conversationId: string, content: string, userId: string): Promise<Message> {
  const response = await apiCall<{ message: Message }>("/api/chat/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversationId, content, userId }),
  })

  return response.message
}

/**
 * Perform search across documents
 * @param userId User ID for context
 * @param query Search query text
 * @param options Search options including type and filters
 * @returns Search results array
 */
export async function performSearch(
  userId: string,
  query: string,
  options: {
    type?: "semantic" | "keyword" | "hybrid"
    documentTypes?: string[]
    sortBy?: string
    dateRange?: { from?: string; to?: string }
  } = {},
): Promise<SearchResult[]> {
  // Build query string
  let url = `/api/search?userId=${encodeURIComponent(userId)}&q=${encodeURIComponent(query)}`

  // Add search type
  if (options.type) {
    url += `&type=${encodeURIComponent(options.type)}`
  }

  // Add document type filters if any
  if (options.documentTypes && options.documentTypes.length > 0) {
    options.documentTypes.forEach((type) => {
      url += `&documentType=${encodeURIComponent(type)}`
    })
  }

  // Add sort option if specified
  if (options.sortBy) {
    url += `&sortBy=${encodeURIComponent(options.sortBy)}`
  }

  // Add date range if specified
  if (options.dateRange) {
    if (options.dateRange.from) {
      url += `&from=${encodeURIComponent(options.dateRange.from)}`
    }
    if (options.dateRange.to) {
      url += `&to=${encodeURIComponent(options.dateRange.to)}`
    }
  }

  // Execute search
  const response = await apiCall<{ results: SearchResult[] }>(url)
  return Array.isArray(response.results) ? response.results : []
}
