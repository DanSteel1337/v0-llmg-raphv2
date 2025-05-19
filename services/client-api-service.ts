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
  const response = await fetch(`/api/documents?userId=${userId}`)

  if (!response.ok) {
    throw new Error("Failed to fetch documents")
  }

  const { data } = await response.json()
  return data.documents || []
}

export async function uploadDocument(userId: string, file: File): Promise<Document> {
  // 1. Upload file to storage
  const formData = new FormData()
  formData.append("file", file)
  formData.append("userId", userId)

  const uploadResponse = await fetch("/api/documents/upload", {
    method: "POST",
    body: formData,
  })

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file")
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
    throw new Error("Failed to create document record")
  }

  const { data: documentData } = await createResponse.json()
  return documentData.document
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
  })

  if (!response.ok) {
    throw new Error("Failed to delete document")
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

  const response = await fetch(`/api/search?${params.toString()}`)

  if (!response.ok) {
    throw new Error("Failed to perform search")
  }

  const { data } = await response.json()
  return data.results || []
}

// Chat API methods
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const response = await fetch(`/api/conversations?userId=${userId}`)

  if (!response.ok) {
    throw new Error("Failed to fetch conversations")
  }

  const { data } = await response.json()
  return data.conversations || []
}

export async function createConversation(userId: string, title: string): Promise<Conversation> {
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
    throw new Error("Failed to create conversation")
  }

  const { data } = await response.json()
  return data.conversation
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const response = await fetch(`/api/chat/messages?conversationId=${conversationId}`)

  if (!response.ok) {
    throw new Error("Failed to fetch messages")
  }

  const { data } = await response.json()
  return data.messages || []
}

export async function sendMessage(conversationId: string, content: string, userId: string): Promise<ChatMessage> {
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
    throw new Error("Failed to send message")
  }

  const { data } = await response.json()
  return data.message
}

// Analytics API methods
export async function fetchAnalytics(userId: string): Promise<AnalyticsData> {
  const response = await fetch(`/api/analytics?userId=${userId}`)

  if (!response.ok) {
    throw new Error("Failed to fetch analytics")
  }

  const { data } = await response.json()
  return data
}
