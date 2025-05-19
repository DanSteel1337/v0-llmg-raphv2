/**
 * Client API Service
 *
 * This file contains all client-side API functions for interacting with the server.
 *
 * EXPORTS:
 * ---------
 * - fetchDocuments: Fetches all documents for a user
 * - uploadDocument: Uploads a document for a user
 * - deleteDocument: Deletes a document by ID
 * - fetchAnalytics: Fetches analytics data for a user
 * - checkApiHealth: Checks the health of the API and its services
 * - fetchConversations: Fetches all conversations for a user
 * - createConversation: Creates a new conversation
 * - fetchMessages: Fetches all messages for a conversation
 * - sendMessage: Sends a message in a conversation
 * - performSearch: Performs a search with optional filters
 *
 * IMPORTANT: When adding new functions to this file, please update the exports list above.
 */

import { apiCall } from "./apiCall"

/**
 * Fetch documents for a user
 */
export async function fetchDocuments(userId: string): Promise<Document[]> {
  return await apiCall<Document[]>(`/api/documents?userId=${userId}`)
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
  const response = await apiCall<{ document: Document } | Document>("/api/documents", {
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

  // Log the response for debugging
  console.log("Document creation response:", response)

  // Handle both response formats: { document: {...} } or the document directly
  let document: Document

  if ("document" in response && response.document) {
    // Response format is { document: {...} }
    document = response.document
  } else if ("id" in response && response.id) {
    // Response format is the document directly
    document = response as Document
  } else {
    console.error("Invalid document response format:", response)
    throw new Error("Document upload failed: Invalid response format")
  }

  // Validate document ID
  if (!document?.id || typeof document.id !== "string") {
    console.error("Invalid document response - invalid ID:", document)
    throw new Error("Document upload failed: Missing or invalid document ID")
  }

  // Validate file path
  if (!document?.file_path || typeof document.file_path !== "string") {
    console.error("Invalid document response - invalid file_path:", document)
    throw new Error("Document upload failed: Missing or invalid file path")
  }

  // Then, upload the file
  const formData = new FormData()
  formData.append("file", file)
  formData.append("userId", userId)
  formData.append("documentId", document.id)
  formData.append("filePath", document.file_path)

  try {
    const uploadResponse = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    })

    if (uploadResponse.status === 405) {
      throw new Error("Upload failed: endpoint does not support this method.")
    }

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status ${uploadResponse.status}: ${uploadResponse.statusText}`)
    }

    await uploadResponse.json()
  } catch (error) {
    console.error("File upload error:", error)
    throw new Error(`File upload failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }

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
export async function deleteDocument(documentId: string): Promise<{ success: boolean }> {
  return await apiCall<{ success: boolean }>(`/api/documents/${documentId}`, {
    method: "DELETE",
  })
}

/**
 * Fetch analytics data
 */
export async function fetchAnalytics(userId: string, timeRange = "7d"): Promise<AnalyticsData> {
  return await apiCall<AnalyticsData>(`/api/analytics?userId=${userId}&timeRange=${timeRange}`)
}

/**
 * Check API health
 */
export async function checkApiHealth(): Promise<{ status: string; services: Record<string, boolean> }> {
  return await apiCall<{ status: string; services: Record<string, boolean> }>("/api/debug/check-health")
}

/**
 * Fetch conversations
 */
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  return await apiCall<Conversation[]>(`/api/conversations?userId=${userId}`)
}

/**
 * Create a new conversation
 */
export async function createConversation(userId: string, title: string): Promise<Conversation> {
  return await apiCall<Conversation>("/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, title }),
  })
}

/**
 * Fetch messages for a conversation
 */
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  return await apiCall<Message[]>(`/api/chat/messages?conversationId=${conversationId}`)
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(conversationId: string, userId: string, content: string): Promise<Message> {
  return await apiCall<Message>("/api/chat/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conversationId, userId, content }),
  })
}

/**
 * Perform search
 */
export async function performSearch(
  query: string,
  filters?: { [key: string]: string | string[] },
  page = 1,
  limit = 10,
): Promise<SearchResults> {
  // Construct query string
  let queryString = `query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`

  // Add filters if provided
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => {
          queryString += `&${key}=${encodeURIComponent(v)}`
        })
      } else {
        queryString += `&${key}=${encodeURIComponent(value)}`
      }
    })
  }

  return await apiCall<SearchResults>(`/api/search?${queryString}`)
}

// Type definitions for the API responses
interface Document {
  id: string
  name: string
  file_path: string
  status?: string
  processing_progress?: number
  [key: string]: any
}

interface AnalyticsData {
  totalDocuments: number
  totalSearches: number
  totalChats: number
  searchesByDay: { date: string; count: number }[]
  topSearches: { query: string; count: number }[]
  [key: string]: any
}

interface Conversation {
  id: string
  title: string
  userId: string
  createdAt: string
  updatedAt: string
  [key: string]: any
}

interface Message {
  id: string
  conversationId: string
  userId: string
  content: string
  role: "user" | "assistant"
  createdAt: string
  [key: string]: any
}

interface SearchResults {
  results: SearchResult[]
  totalResults: number
  page: number
  totalPages: number
  [key: string]: any
}

interface SearchResult {
  id: string
  content: string
  documentId: string
  documentName: string
  score: number
  [key: string]: any
}
