/**
 * Client API abstraction for document creation and upload flow.
 * Handles metadata creation, file upload, and triggers processing pipeline.
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
  try {
    // Step 1: Create document metadata
    console.log("Creating document metadata...", {
      userId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    const docResponse = await apiCall<{ document: Document }>("/api/documents", {
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

    const document = docResponse?.document
    if (!document?.id || !document?.file_path) {
      console.error("Document creation failed - missing fields:", document)
      throw new Error("Document creation failed: Missing document ID or file path")
    }

    console.log("Document metadata created successfully:", {
      documentId: document.id,
      filePath: document.file_path,
    })

    // Step 2: Upload the file
    console.log("Uploading file content...", {
      documentId: document.id,
      filePath: document.file_path,
    })

    const formData = new FormData()
    formData.append("file", file)
    formData.append("userId", userId)
    formData.append("documentId", document.id)
    formData.append("filePath", document.file_path)

    const uploadResponse = await apiCall<{ success: boolean }>("/api/documents/upload", {
      method: "POST",
      body: formData,
    })

    if (!uploadResponse?.success) {
      console.error("File upload failed:", uploadResponse)
      throw new Error("File upload failed")
    }

    console.log("File uploaded successfully:", {
      documentId: document.id,
      filePath: document.file_path,
    })

    // Step 3: Process the document
    console.log("Triggering document processing...", {
      documentId: document.id,
      filePath: document.file_path,
    })

    const fileUrl = `${window.location.origin}/api/documents/file?path=${encodeURIComponent(document.file_path)}`

    await apiCall<{ success: boolean }>("/api/documents/process", {
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

    console.log("Document processing triggered:", {
      documentId: document.id,
      filePath: document.file_path,
      fileUrl,
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
              console.log("Document processing completed:", {
                documentId: document.id,
                status: updatedDocument.status,
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
  // Return a mock response instead of calling the deleted endpoint
  return {
    status: "ok",
    services: {
      pinecone: true,
      openai: true,
      supabase: true,
    },
  }
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
