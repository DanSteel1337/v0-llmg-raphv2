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
  description: string
  file_type: string
  file_size: number
  file_path: string
  status: "processing" | "indexed" | "failed"
  processing_progress?: number
  error_message?: string
  created_at: string
  updated_at: string
}

// Document processing options
export interface ProcessDocumentOptions {
  documentId: string
  userId: string
  filePath: string
  fileName: string
  fileType: string
  fileUrl: string
}

// Chunk metadata
export interface ChunkMetadata {
  index: number
  document_id: string
  document_name: string
  document_type: string
  user_id: string
  record_type: string
  created_at: string
}

// Search result
export interface SearchResult {
  id: string
  score: number
  content: string
  document_id: string
  document_name: string
  document_type: string
  created_at: string
}

// Analytics data
export interface AnalyticsData {
  documents: number
  chunks: number
  searches: number
  chats: number
}

// Conversation
export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
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
