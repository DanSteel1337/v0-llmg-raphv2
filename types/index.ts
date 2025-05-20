/**
 * Type Definitions
 *
 * Central location for type definitions used throughout the application.
 */

// Document types
export interface Document {
  id: string
  user_id: string
  name: string
  description?: string
  file_type: string
  file_size: number
  file_path: string
  status: "created" | "processing" | "indexed" | "failed"
  processing_progress?: number
  processing_step?: ProcessingStep
  error_message?: string
  created_at: string
  updated_at: string
  chunk_count?: number
  embedding_model?: string
}

// Document processing step - defined as an enum for type safety
export enum ProcessingStep {
  INITIALIZING = "initializing",
  READING_FILE = "reading_file",
  CHUNKING = "chunking",
  EMBEDDING = "embedding",
  INDEXING = "indexing",
  FINALIZING = "finalizing",
  COMPLETED = "completed",
  FAILED = "failed",
}

// Search options
export interface SearchOptions {
  type: "semantic" | "keyword" | "hybrid"
  documentTypes?: string[]
  sortBy?: string
  dateRange?: {
    from?: Date
    to?: Date
  }
}

// Search result
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

// Analytics data
export interface AnalyticsData {
  documents: number
  chunks: number
  searches: number
  chats: number
  processingStats?: {
    avgProcessingTime: number
    successRate: number
  }
}

// Conversation
export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
  message_count?: number
}

// Message
export interface Message {
  id: string
  conversation_id: string
  user_id: string
  content: string
  role: "user" | "assistant"
  created_at: string
}

// API Response
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Document processing options
export interface ProcessDocumentOptions {
  documentId: string
  userId: string
  filePath: string
  fileName: string
  fileType: string
  fileUrl: string
  onProgress?: (progress: number, step?: ProcessingStep) => void
}

// Document chunk
export interface DocumentChunk {
  id: string
  document_id: string
  content: string
  metadata: {
    document_name: string
    document_type: string
    chunk_index: number
    total_chunks: number
  }
}

// Toast types
export type ToastType = "success" | "error" | "info" | "warning"

// Toast message
export interface ToastMessage {
  id: string
  type: ToastType
  title?: string
  description: string
  duration?: number
}
