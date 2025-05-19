/**
 * Client API Service
 *
 * Provides client-side API functions for interacting with the backend.
 * This service is used by React hooks to fetch data from the API.
 */

import type { Document, SearchResult, SearchOptions, Conversation, ChatMessage, AnalyticsData } from "@/types"

/**
 * Base API call function with error handling
 */
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      let errorMessage = `API error: ${response.status} ${response.statusText}`

      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }

      throw new Error(errorMessage)
    }

    return await response.json()
  } catch (error) {
    console.error(`API call failed: ${url}`, error)
    throw error
  }
}

/**
 * Fetch documents for a user
 */
export async function fetchDocuments(userId: string): Promise<Document[]> {
  const { documents } = await apiCall<{ documents: Document[] }>(`/api/documents?userId=${encodeURIComponent(userId)}`)
  return documents
}

/**
 * Upload a document
 */
export async function uploadDocument(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<Document> {
  // First, create a document record
  const { document } = await apiCall<{ document: Document }>("/api/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      name: file.name,
      fileType: file.type,
      fileSize: file.size,
      filePath: `${userId}/${Date.now()}-${file.name}`,
    }),
  })

  // Add this validation and logging right after the above code
  console.log("Document creation response:", document)
  if (!document?.id) {
    throw new Error("Document upload failed: Missing document ID in response")
  }

  // Then, upload the file
  const formData = new FormData()
  formData.append("file", file)
  formData.append("userId", userId)
  formData.append("documentId", document.id)
  formData.append("filePath", document.file_path)

  await apiCall<{ success: boolean }>("/api/documents/upload", {
    method: "POST",
    body: formData,
  })

  // Poll for document status updates
  if (onProgress) {
    const pollInterval = setInterval(async () => {
      try {
        const documents = await fetchDocuments(userId)
        const updatedDocument = documents.find((d) => d.id === document.id)

        if (updatedDocument) {
          if (updatedDocument.status === "indexed" || updatedDocument.status === "failed") {
            clearInterval(pollInterval)
            onProgress(100)
          } else if (updatedDocument.processing_progress !== undefined) {
            onProgress(updatedDocument.processing_progress)
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
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  await apiCall<{ success: boolean }>(`/api/documents/${id}`, {
    method: "DELETE",
  })
}

/**
 * Search documents
 */
export async function performSearch(userId: string, query: string, options: SearchOptions): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    userId,
    q: query,
    type: options.type,
  })

  if (options.documentTypes && options.documentTypes.length > 0) {
    options.documentTypes.forEach((type) => params.append("documentTypes", type))
  }

  if (options.sortBy) {
    params.append("sortBy", options.sortBy)
  }

  if (options.dateRange?.from) {
    params.append("dateFrom", options.dateRange.from.toISOString())
  }

  if (options.dateRange?.to) {
    params.append("dateTo", options.dateRange.to.toISOString())
  }

  const { results } = await apiCall<{ results: SearchResult[] }>(`/api/search?${params.toString()}`)
  return results
}

/**
 * Fetch conversations for a user
 */
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { conversations } = await apiCall<{ conversations: Conversation[] }>(
    `/api/conversations?userId=${encodeURIComponent(userId)}`,
  )
  return conversations
}

/**
 * Create a new conversation
 */
export async function createConversation(userId: string, title?: string): Promise<Conversation> {
  const { conversation } = await apiCall<{ conversation: Conversation }>("/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      title: title || "New Conversation",
    }),
  })
  return conversation
}

/**
 * Fetch messages for a conversation
 */
export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { messages } = await apiCall<{ messages: ChatMessage[] }>(
    `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`,
  )
  return messages
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(conversationId: string, content: string, userId: string): Promise<ChatMessage> {
  const { message } = await apiCall<{ message: ChatMessage }>("/api/chat/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationId,
      content,
      userId,
    }),
  })
  return message
}

/**
 * Fetch analytics data
 */
export async function fetchAnalytics(userId: string): Promise<AnalyticsData> {
  return await apiCall<AnalyticsData>(`/api/analytics?userId=${encodeURIComponent(userId)}`)
}
