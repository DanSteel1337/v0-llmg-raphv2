/**
 * Client API Service
 *
 * Service layer for client-side API interactions.
 * Handles HTTP requests to the API endpoints.
 *
 * Dependencies:
 * - @/types for type definitions
 * - @/services/apiCall for standardized API requests
 */

import { apiCall } from "./apiCall"
import type { Document, AnalyticsData, Conversation, Message, SearchResult, SearchOptions } from "@/types"

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
    const response = await apiCall<{ documents: Document[] }>(`/api/documents?userId=${encodeURIComponent(userId)}`)

    if (!response || !response.documents) {
      console.warn("Received invalid response from documents API", { response })
      return []
    }

    return Array.isArray(response.documents) ? response.documents : []
  } catch (error) {
    console.error("Error fetching documents:", error)
    return []
  }
}

/**
 * Upload a document
 *
 * @param userId User ID who owns the document
 * @param file File to upload
 * @param onProgress Optional progress callback
 * @returns Uploaded document metadata
 */
export async function uploadDocument(
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

    const createResponse = await apiCall<{ document: Document }>("/api/documents", {
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
    if (!createResponse || !createResponse.document?.id || !createResponse.document?.file_path) {
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
      fileUrl: string
      blobUrl?: string
    }>("/api/documents/upload", {
      method: "POST",
      body: formData,
    })

    if (!uploadResponse || (!uploadResponse.fileUrl && !uploadResponse.blobUrl)) {
      console.error("File upload failed:", uploadResponse)
      throw new Error("File upload failed: No file URL returned")
    }

    // Prioritize blobUrl if available, fall back to fileUrl
    const fileUrl =
      uploadResponse.blobUrl ||
      uploadResponse.fileUrl ||
      `/api/documents/file?path=${encodeURIComponent(document.file_path)}`

    console.log("File uploaded successfully:", {
      documentId: document.id,
      filePath: document.file_path,
      fileUrl,
      hasBlobUrl: !!uploadResponse.blobUrl,
    })

    // Step 3: Process the document
    console.log("Triggering document processing...", {
      documentId: document.id,
      filePath: document.file_path,
      fileUrl,
    })

    try {
      const processResponse = await apiCall<{ status?: string; message?: string; error?: string }>(
        "/api/documents/process",
        {
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
        },
      )

      // Log the full response for debugging
      console.log("Document processing response:", processResponse)

      // Check for error in response
      if (processResponse?.error) {
        console.error("Document processing failed to start:", {
          error: processResponse.error,
          response: processResponse,
        })
        throw new Error(`Failed to start document processing: ${processResponse.error}`)
      }

      console.log("Document processing triggered:", {
        documentId: document.id,
        filePath: document.file_path,
        fileUrl,
        status: processResponse?.status || "processing",
      })
    } catch (processError) {
      console.error("Error triggering document processing:", processError)
      throw new Error(
        `Failed to start document processing: ${
          processError instanceof Error ? processError.message : "Unknown error"
        }`,
      )
    }

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
 * Delete a document
 *
 * @param id Document ID to delete
 * @returns Success indicator
 */
export async function deleteDocument(id: string): Promise<boolean> {
  if (!id) {
    console.error("deleteDocument called without documentId")
    throw new Error("Document ID is required")
  }

  try {
    const response = await apiCall<{ success?: boolean }>(`/api/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })

    return response?.success === true
  } catch (error) {
    console.error("Error deleting document:", error)
    throw error
  }
}

/**
 * Retry document processing
 *
 * @param documentId Document ID to retry processing for
 * @returns Success indicator
 */
export async function retryDocumentProcessing(documentId: string): Promise<boolean> {
  if (!documentId) {
    console.error("retryDocumentProcessing called without documentId")
    throw new Error("Document ID is required")
  }

  try {
    const response = await apiCall<{ success?: boolean }>("/api/documents/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    })

    return response?.success === true
  } catch (error) {
    console.error("Error retrying document processing:", error)
    throw error
  }
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
    const response = await apiCall<{ data: AnalyticsData }>(url)

    if (!response || !response.data) {
      console.warn("Received invalid response from analytics API", { response })
      return {
        documentCount: 0,
        chunkCount: 0,
        searchCount: 0,
        chatCount: 0,
        topDocuments: [],
        topSearches: [],
      }
    }

    return response.data
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
 * @returns Health status
 */
export async function checkApiHealth(): Promise<{ status: string; services: Record<string, boolean> }> {
  try {
    const response = await apiCall<{
      status: string
      services: Record<string, boolean>
    }>("/api/health")

    if (!response) {
      console.warn("Received invalid response from health API", { response })
      return { status: "error", services: {} }
    }

    return {
      status: response.status || "unknown",
      services: response.services || {},
    }
  } catch (error) {
    console.error("Error checking API health:", error)
    return { status: "error", services: {} }
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

    const response = await apiCall<{ conversations: Conversation[] }>(
      `/api/conversations?userId=${encodeURIComponent(userId)}`,
    )

    if (!response || !response.conversations) {
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

    const response = await apiCall<{ conversation: Conversation }>("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        title: title || `Conversation ${new Date().toLocaleString()}`,
      }),
    })

    if (!response || !response.conversation) {
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

    const response = await apiCall<{ messages: Message[] }>(
      `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`,
    )

    if (!response || !response.messages) {
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
 * @param userId User ID who is sending the message
 * @param content Message content
 * @param onChunk Optional callback for streaming responses
 * @returns Created message
 */
export async function sendMessage(
  conversationId: string,
  userId: string,
  content: string,
  onChunk?: (chunk: string) => void,
): Promise<Message | null> {
  try {
    if (!conversationId) throw new Error("Conversation ID is required")
    if (!userId) throw new Error("User ID is required")
    if (!content) throw new Error("Message content is required")

    // If no streaming callback, use regular API call
    if (!onChunk) {
      const response = await apiCall<{ message: Message }>("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          userId,
          content,
        }),
      })

      if (!response || !response.message) {
        console.warn("Received invalid response from send message API", { response })
        return null
      }

      return response.message
    }

    // Handle streaming response
    const response = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        userId,
        content,
        stream: true,
      }),
    })

    if (!response.ok || !response.body) {
      throw new Error(`Failed to send message: ${response.status}`)
    }

    // Process the stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let accumulatedContent = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      accumulatedContent += chunk
      onChunk(chunk)
    }

    // Return a synthetic message object
    return {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      role: "assistant",
      content: accumulatedContent,
      created_at: new Date().toISOString(),
    }
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
export async function performSearch(userId: string, query: string, options?: SearchOptions): Promise<SearchResult[]> {
  try {
    if (!userId) throw new Error("User ID is required")
    if (!query) throw new Error("Search query is required")

    const searchParams = new URLSearchParams({
      userId,
      query,
    })

    // Add any options to the search params
    if (options) {
      if (options.type) searchParams.append("type", options.type)

      if (options.documentTypes && options.documentTypes.length > 0) {
        searchParams.append("documentTypes", options.documentTypes.join(","))
      }

      if (options.sortBy) searchParams.append("sortBy", options.sortBy)

      if (options.dateRange) {
        if (options.dateRange.from) {
          searchParams.append("from", options.dateRange.from.toISOString())
        }
        if (options.dateRange.to) {
          searchParams.append("to", options.dateRange.to.toISOString())
        }
      }
    }

    const response = await apiCall<{ results: SearchResult[] }>(`/api/search?${searchParams.toString()}`)

    if (!response || !response.results) {
      console.warn("Received invalid response from search API", { response })
      return []
    }

    return Array.isArray(response.results) ? response.results : []
  } catch (error) {
    console.error("Error performing search:", error)
    return []
  }
}
