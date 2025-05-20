/**
 * Type Definitions
 *
 * Shared types used throughout the application.
 * Provides consistent interfaces for documents, search, chats, analytics, etc.
 *
 * IMPORTANT:
 * - ALWAYS use these shared types for consistency
 * - NEVER modify the core fields without updating all usages
 * - ALWAYS use the standard document status values: "processing", "indexed", "failed"
 * - Document IDs should follow the format: doc_${timestamp}_${random}
 *
 * @module types/index
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
  blob_url?: string // Added for Vercel Blob integration
  status: DocumentStatus
  processing_progress?: number
  processing_step?: ProcessingStep // Added for detailed progress tracking
  error_message?: string
  created_at: string
  updated_at: string
  chunk_count?: number
  token_count?: number
  embedding_model?: string
  debug_info?: Record<string, any>
}

// Document processing step
export type ProcessingStep =
  | "initializing"
  | "reading_file"
  | "chunking"
  | "embedding"
  | "indexing"
  | "finalizing"
  | "completed"
  | "failed"

// Document status
export type DocumentStatus = "processing" | "indexed" | "failed"

// Document processing options
export interface ProcessDocumentOptions {
  documentId: string
  userId: string
  filePath: string
  fileName: string
  fileType: string
  fileUrl: string
}

// Chat message
export interface ChatMessage {
  id: string
  conversation_id: string
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
  sources?: string[]
}

// Message creation options
export interface CreateMessageOptions {
  conversationId: string
  role: "user" | "assistant" | "system"
  content: string
  sources?: string[]
  turnIndex?: number
}

// Conversation
export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
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
  documentCount: number
  chunkCount: number
  searchCount: number
  chatCount: number
  topDocuments: Array<{
    id: string
    name: string
    chunkCount: number
    createdAt: string
  }>
  topSearches: Array<{
    query: string
    count: number
    timestamp: string
  }>
  mightBeTruncated?: {
    documents: boolean
    chunks: boolean
    searches: boolean
    chats: boolean
  }
}

// Message type
export interface Message {
  id: string
  conversation_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  sources?: string[]
  metadata?: Record<string, any>
}
