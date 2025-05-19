/**
 * Types
 *
 * Centralized type definitions for the application.
 * This file contains all shared types used across the application.
 */

// Document types
export interface Document {
  id: string
  name: string
  description?: string
  file_type: string
  file_size: number
  file_path: string
  status: "processing" | "indexed" | "failed"
  processing_progress?: number
  error_message?: string
  created_at: string
  updated_at: string
  user_id: string
}

// Document chunk types
export interface DocumentChunk {
  id: string
  content: string
  metadata: ChunkMetadata
}

export interface ChunkMetadata {
  index: number
  document_id: string
  document_name: string
  document_type: string
  user_id: string
  section?: string
  page?: number
  record_type: "chunk"
  created_at: string
}

// Search types
export interface SearchResult {
  id: string
  title: string
  content: string
  documentName: string
  documentType: string
  date: string
  relevance: number
  highlights: string[]
}

export interface SearchOptions {
  type: "semantic" | "keyword" | "hybrid"
  documentTypes?: string[]
  sortBy?: string
  dateRange?: { from?: Date; to?: Date }
}

// Chat types
export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ChatMessage {
  id: string
  conversation_id: string
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
  sources?: string[]
}

export interface CreateMessageOptions {
  conversationId: string
  role: "user" | "assistant" | "system"
  content: string
  sources?: string[]
}

// API response types
export interface ApiError {
  error: string
  details?: unknown
  code?: string
}

export interface ApiSuccess<T> {
  success: true
  data: T
}

// Process document options
export interface ProcessDocumentOptions {
  documentId: string
  userId: string
  filePath: string
  fileName: string
  fileType: string
  fileUrl: string
}

// Analytics types
export interface AnalyticsData {
  documentCount: number
  searchCount: number
  chatCount: number
  topDocuments: {
    name: string
    accessCount: number
  }[]
  topSearches: {
    query: string
    count: number
  }[]
}

// Chat message type
export interface Message {
  id: string
  conversation_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

// Chat context type
export interface ChatContext {
  content: string
  document_name: string
  section?: string
}

export type Role = "user" | "assistant" | "system"
