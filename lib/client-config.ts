/**
 * Client-side Configuration
 *
 * Safe configuration values for client-side code.
 * Does NOT access server-side environment variables.
 */

// Fixed values for client-side use
export const CLIENT_CONFIG = {
  // Embedding configuration
  embeddingModel: "text-embedding-3-large",
  vectorDimension: 3072,

  // API endpoints
  apiEndpoints: {
    documents: "/api/documents",
    search: "/api/search",
    chat: "/api/chat/messages",
    conversations: "/api/conversations",
    analytics: "/api/analytics",
    debug: "/api/debug",
  },

  // Feature flags
  features: {
    enableSearch: true,
    enableChat: true,
    enableAnalytics: true,
    enableDocumentUpload: true,
  },

  // UI configuration
  ui: {
    maxSearchResults: 10,
    maxRecentSearches: 5,
    maxRecentDocuments: 5,
    maxRecentConversations: 5,
  },
}

// Export individual values for convenience
export const EMBEDDING_MODEL = CLIENT_CONFIG.embeddingModel
export const VECTOR_DIMENSION = CLIENT_CONFIG.vectorDimension
