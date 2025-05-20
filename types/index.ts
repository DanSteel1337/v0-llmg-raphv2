// types/index.ts
export interface Document {
  id: string
  user_id: string
  name: string
  description: string
  file_type: string
  file_size: number
  file_path: string
  blob_url?: string
  status: "processing" | "indexed" | "failed"
  processing_progress: number
  processing_step?: ProcessingStep
  error_message?: string
  created_at: string
  updated_at: string
  debug_info?: Record<string, any>
}

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

export interface ProcessDocumentOptions {
  documentId: string
  userId: string
  filePath: string
  fileName: string
  fileType: string
  fileUrl: string
  isRetry?: boolean
}

export interface AnalyticsData {
  documentCount: number
  chunkCount: number
  searchCount: number
  chatCount: number
  topDocuments: Array<{
    id: string
    name: string
    count: number
  }>
  topSearches: Array<{
    query: string
    count: number
  }>
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
  message_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  content: string
  role: "user" | "assistant"
  created_at: string
}

export interface SearchResult {
  id: string
  content: string
  document_id: string
  document_name: string
  score: number
  metadata?: Record<string, any>
}

export interface SearchOptions {
  type?: "semantic" | "keyword" | "hybrid"
  documentTypes?: string[]
  sortBy?: "relevance" | "date"
  dateRange?: {
    from?: Date
    to?: Date
  }
}
