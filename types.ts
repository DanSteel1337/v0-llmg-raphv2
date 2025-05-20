/**
 * Type Definitions
 *
 * Central location for type definitions used throughout the application.
 */

// Document processing step - defined as an enum so it exists at runtime
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

// Document types
export interface Document {
  id: string
  user_id: string
  name: string
  description: string
  file_type: string
  file_size: number
  file_path: string
  status: "created" | "processing" | "indexed" | "failed" // UPDATED: Added "created" status for backward compatibility
  processing_progress?: number
  processing_step?: ProcessingStep // Reference to the enum
  error_message?: string
  created_at: string
  updated_at: string
  chunk_count?: number // Added for completeness
  embedding_model?: string // Added for completeness
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

// Document status
export type DocumentStatus = "processing" | "indexed" | "failed"
