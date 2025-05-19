/**
 * Client API Service
 *
 * Provides client-side methods for interacting with the API.
 * This service acts as a bridge between client components and server-side API routes.
 *
 * IMPORTANT: This service is safe to use in client components as it doesn't
 * directly import any Node.js-specific modules.
 */

import type { Document, SearchResult, SearchOptions, Conversation, ChatMessage, AnalyticsData } from "@/types"

// Document API methods
export async function fetchDocuments(userId: string): Promise<Document[]> {
  try {
    const response = await fetch(`/api/documents?userId=${userId}`)

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to fetch documents: ${response.status}`)
    }

    const { data } = await response.json()
    return data.documents || []
  } catch (error) {
    console.error("Error fetching documents:", error)
    throw error
  }
}

export async function uploadDocument(userId: string, file: File): Promise<Document> {
  try {
    // 1. Upload file to storage
    const formData = new FormData()
    formData.append("file", file)
    formData.append("userId", userId)

    const uploadResponse = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    })

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json()
      throw new Error(errorData.error || `Failed to upload file: ${uploadResponse.status}`)
    }

    const { data: uploadData } = await uploadResponse.json()

    // 2. Create document record
    const createResponse = await fetch("/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        name: file.name,
        fileType: file.type,
        fileSize: file.size,
        filePath: uploadData.path,
      }),
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json()
      throw new Error(errorData.error || `Failed to create document record: ${createResponse.status}`)
    }

    const { data: documentData } = await createResponse.json()
    return documentData.document
  } catch (error) {
    console.error("Error uploading document:", error)
    throw error
  }
}

export async function deleteDocument(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to delete document: ${response.status}`)
    }
  } catch (error) {
    console.error("Error deleting document:", error)
    throw error
  }
}

// Search API methods
export async function performSearch(userId: string, query: string, options: SearchOptions): Promise<SearchResult[]> {
  // Build query parameters
  const params = new URLSearchParams({
    userId,
    q: query,
    type: options.type,
  })

  // Add document types if provided
  if (options.documentTypes && options.documentTypes.length > 0) {
    options.documentTypes.forEach((type) => {
      params.append("documentType", type)
    })
  }

  // Add sort option if provided
  if (options.sortBy) {
    params.append("sortBy", options.sortBy)
  }

  // Add date range if provided
  if (options.dateRange?.from) {
    params.append("from", options.dateRange.from.toISOString())
  }
  if (options.dateRange?.to) {
    params.append("to", options.dateRange.to.toISOString())
  }

  try {
    const response = await fetch(`/api/search?${params.toString()}`)

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Search failed with status: ${response.status}`)
    }

    const { data } = await response.json()
    return data.results || []
  } catch (error) {
    console.error("Search API error:", error)
    throw error
  }
}

// Chat API methods
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  try {
    const response = await fetch(`/api/conversations?userId=${userId}`)

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to fetch conversations: ${response.status}`)
    }

    const { data } = await response.json()
    return data.conversations || []
  } catch (error) {
    console.error("Error fetching conversations:", error)
    throw error
  }
}

export async function createConversation(userId: string, title: string): Promise<Conversation> {
  try {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        title,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to create conversation: ${response.status}`)
    }

    const { data } = await response.json()
    return data.conversation
  } catch (error) {
    console.error("Error creating conversation:", error)
    throw error
  }
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const response = await fetch(`/api/chat/messages?conversationId=${conversationId}`)

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to fetch messages: ${response.status}`)
    }

    const { data } = await response.json()
    return data.messages || []
  } catch (error) {
    console.error("Error fetching messages:", error)
    throw error
  }
}

export async function sendMessage(conversationId: string, content: string, userId: string): Promise<ChatMessage> {
  try {
    const response = await fetch("/api/chat/messages", {
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

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to send message: ${response.status}`)
    }

    const { data } = await response.json()
    return data.message
  } catch (error) {
    console.error("Error sending message:", error)
    throw error
  }
}

// Analytics API methods
export async function fetchAnalytics(userId: string): Promise<AnalyticsData> {
  try {
    const response = await fetch(`/api/analytics?userId=${userId}`)

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to fetch analytics: ${response.status}`)
    }

    const { data } = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching analytics:", error)
    throw error
  }
}
