/**
 * Application Constants
 *
 * This file contains all the constants used throughout the application.
 * Centralizing constants helps maintain consistency and makes updates easier.
 */

/**
 * Document processing steps
 *
 * Represents the various stages a document goes through during processing
 */
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

/**
 * API endpoints
 *
 * Base URLs for API endpoints
 */
export const API_ENDPOINTS = {
  DOCUMENTS: "/api/documents",
  SEARCH: "/api/search",
  ANALYTICS: "/api/analytics",
  CONVERSATIONS: "/api/conversations",
  CHAT: "/api/chat",
  HEALTH: "/api/health",
}

/**
 * Search types
 *
 * Different types of search supported by the application
 */
export const SEARCH_TYPES = {
  SEMANTIC: "semantic",
  KEYWORD: "keyword",
  HYBRID: "hybrid",
}

/**
 * Default values
 *
 * Default values used throughout the application
 */
export const DEFAULTS = {
  SEARCH_TYPE: SEARCH_TYPES.SEMANTIC,
  SEARCH_RESULTS_LIMIT: 10,
  RECENT_SEARCHES_LIMIT: 5,
  DOCUMENT_CHUNK_SIZE: 1000,
  DOCUMENT_CHUNK_OVERLAP: 200,
}

/**
 * Error messages
 *
 * Standard error messages used throughout the application
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "You are not authorized to perform this action",
  DOCUMENT_NOT_FOUND: "Document not found",
  PROCESSING_FAILED: "Document processing failed",
  SEARCH_FAILED: "Search failed",
  INVALID_REQUEST: "Invalid request",
  SERVER_ERROR: "Server error occurred",
}

/**
 * Success messages
 *
 * Standard success messages used throughout the application
 */
export const SUCCESS_MESSAGES = {
  DOCUMENT_UPLOADED: "Document uploaded successfully",
  DOCUMENT_DELETED: "Document deleted successfully",
  DOCUMENT_PROCESSING: "Document processing started",
  SEARCH_COMPLETED: "Search completed successfully",
}

/**
 * Timeouts
 *
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  API_REQUEST: 30000, // 30 seconds
  DOCUMENT_PROCESSING: 300000, // 5 minutes
  SEARCH_REQUEST: 10000, // 10 seconds
}
