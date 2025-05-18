// Info: Centralized type definitions with better organization

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
