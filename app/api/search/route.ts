/**
 * Enhanced Search API Route
 *
 * Advanced API endpoint for searching documents with multiple search strategies,
 * hybrid search capabilities, reranking, and comprehensive filtering options.
 *
 * Features:
 * - Multiple search modes: semantic, keyword, hybrid
 * - Reranking for improved relevance
 * - Comprehensive filtering by document type, date, and metadata
 * - Pagination for large result sets
 * - Score normalization for consistent ranking
 * - Caching for repeated queries
 * - Detailed error handling with specific error types
 *
 * Dependencies:
 * - @/lib/embedding-service for generating query embeddings
 * - @/lib/pinecone-rest-client for vector operations
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/validation for input validation
 * - @/lib/utils/logger for structured logging
 *
 * @module app/api/search/route
 */

import type { NextRequest } from "next/server"
import { withErrorHandling } from "@/utils/errorHandling"
import { handleApiRequest } from "@/utils/apiRequest"
import { ValidationError } from "@/utils/validation"
import { generateEmbedding, EmbeddingError } from "@/lib/embedding-service"
import { queryVectors, createPlaceholderVector, PineconeError, hybridSearch } from "@/lib/pinecone-rest-client"
import { logger } from "@/lib/utils/logger"

// Custom error class for search operations
class SearchError extends Error {
  status: number
  code: string

  constructor(message: string, code: string, status = 400) {
    super(message)
    this.name = "SearchError"
    this.code = code
    this.status = status
  }
}

// Ensure the Edge runtime is declared
export const runtime = "edge"

// Constants
const DEFAULT_TOP_K = 5
const MAX_TOP_K = 20
const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 1000
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in ms

// Simple in-memory cache for search results
// Note: This will be reset on cold starts in serverless environments
interface CacheEntry {
  results: any
  timestamp: number
}

const searchCache = new Map<string, CacheEntry>()

/**
 * Creates a cache key for a search query and its parameters
 *
 * @param userId - User ID
 * @param query - Search query
 * @param type - Search type
 * @param filters - Search filters
 * @param page - Page number
 * @param pageSize - Page size
 * @returns Cache key
 */
function createCacheKey(
  userId: string,
  query: string,
  type: string,
  filters: any,
  page: number,
  pageSize: number,
): string {
  return `${userId}:${query}:${type}:${JSON.stringify(filters)}:${page}:${pageSize}`
}

/**
 * Validates search parameters
 *
 * @param userId - User ID
 * @param query - Search query
 * @param type - Search type
 * @param topK - Number of results to return
 * @throws ValidationError if parameters are invalid
 */
function validateSearchParams(userId: string | null, query: string | null, type: string | null, topK: number): void {
  if (!userId) {
    throw new ValidationError("User ID is required")
  }

  if (!query) {
    throw new ValidationError("Search query is required")
  }

  if (query.length < MIN_QUERY_LENGTH) {
    throw new ValidationError(`Search query must be at least ${MIN_QUERY_LENGTH} characters`)
  }

  if (query.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(`Search query must be at most ${MAX_QUERY_LENGTH} characters`)
  }

  if (type && !["semantic", "keyword", "hybrid"].includes(type)) {
    throw new ValidationError("Invalid search type. Must be 'semantic', 'keyword', or 'hybrid'")
  }

  if (topK < 1 || topK > MAX_TOP_K) {
    throw new ValidationError(`topK must be between 1 and ${MAX_TOP_K}`)
  }
}

/**
 * Extracts highlights from content based on query terms
 *
 * @param content - Content to extract highlights from
 * @param query - Search query
 * @param maxHighlights - Maximum number of highlights to extract
 * @returns Array of highlight strings
 */
function extractHighlights(content: string, query: string, maxHighlights = 2): string[] {
  if (!content) return []

  const highlights: string[] = []
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2)

  // If no valid query terms, return first chunk of content
  if (queryTerms.length === 0) {
    return [content.substring(0, 150) + "..."]
  }

  // Find paragraphs containing query terms
  const paragraphs = content.split(/\n\s*\n/)

  for (const paragraph of paragraphs) {
    if (highlights.length >= maxHighlights) break

    const paragraphLower = paragraph.toLowerCase()
    if (queryTerms.some((term) => paragraphLower.includes(term))) {
      // Truncate long paragraphs
      const truncated = paragraph.length > 200 ? paragraph.substring(0, 197) + "..." : paragraph

      highlights.push(truncated)
    }
  }

  // If no highlights found, return first chunk of content
  if (highlights.length === 0 && content.length > 0) {
    highlights.push(content.substring(0, 150) + "...")
  }

  return highlights
}

/**
 * Performs keyword search on document content
 *
 * @param query - Search query
 * @param userId - User ID
 * @param filter - Metadata filter
 * @param topK - Number of results to return
 * @returns Search results
 */
async function performKeywordSearch(query: string, userId: string, filter: any, topK: number): Promise<any[]> {
  try {
    // Create a filter that includes the query terms in content
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 2)

    if (queryTerms.length === 0) {
      return []
    }

    // We'll use a metadata filter to find documents containing the query terms
    // This is a simplified approach - in a real implementation, you might use
    // a dedicated text search engine or more sophisticated filtering

    // Query Pinecone with a placeholder vector but rely on metadata filtering
    const placeholderVector = createPlaceholderVector()

    // Add text search conditions to the filter
    const textFilter = {
      ...filter,
      $or: queryTerms.map((term) => ({
        content: { $contains: term },
      })),
    }

    const response = await queryVectors(placeholderVector, {
      topK,
      includeMetadata: true,
      filter: textFilter,
    })

    if (!response.matches || !Array.isArray(response.matches)) {
      return []
    }

    // Format and score results
    return response.matches
      .map((match) => {
        const content = match.metadata?.content || ""
        const contentLower = content.toLowerCase()

        // Calculate a simple relevance score based on term frequency
        let score = 0
        for (const term of queryTerms) {
          // Count occurrences of the term
          const regex = new RegExp(term, "gi")
          const matches = content.match(regex)
          if (matches) {
            score += matches.length * 0.1
          }
        }

        // Normalize score to 0-1 range
        score = Math.min(score, 1)

        return {
          id: match.id,
          title: match.metadata?.document_name || "Unknown",
          content: content,
          documentId: match.metadata?.document_id || match.id,
          documentName: match.metadata?.document_name || "Unknown",
          documentType: match.metadata?.document_type || "Unknown",
          date: match.metadata?.created_at || new Date().toISOString(),
          relevance: score,
          highlights: extractHighlights(content, query),
          chunkIndex: match.metadata?.chunk_index,
          totalChunks: match.metadata?.total_chunks,
        }
      })
      .sort((a, b) => b.relevance - a.relevance)
  } catch (error) {
    logger.error("Error performing keyword search", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
      query,
    })
    return []
  }
}

/**
 * Performs semantic search using vector embeddings
 *
 * @param query - Search query
 * @param userId - User ID
 * @param filter - Metadata filter
 * @param topK - Number of results to return
 * @returns Search results
 */
async function performSemanticSearch(query: string, userId: string, filter: any, topK: number): Promise<any[]> {
  try {
    // Generate embedding for semantic search
    const embedding = await generateEmbedding(query)

    // Query Pinecone
    const response = await queryVectors(embedding, {
      topK,
      includeMetadata: true,
      filter,
    })

    if (!response.matches || !Array.isArray(response.matches)) {
      return []
    }

    // Format results
    return response.matches.map((match) => {
      const content = match.metadata?.content || ""

      return {
        id: match.id,
        title: match.metadata?.document_name || "Unknown",
        content: content,
        documentId: match.metadata?.document_id || match.id,
        documentName: match.metadata?.document_name || "Unknown",
        documentType: match.metadata?.document_type || "Unknown",
        date: match.metadata?.created_at || new Date().toISOString(),
        relevance: match.score || 0,
        highlights: extractHighlights(content, query),
        chunkIndex: match.metadata?.chunk_index,
        totalChunks: match.metadata?.total_chunks,
        section: match.metadata?.section,
        sectionHeading: match.metadata?.section_heading,
      }
    })
  } catch (error) {
    if (error instanceof EmbeddingError) {
      logger.error("Embedding error during semantic search", {
        error: error.message,
        retryable: error.retryable,
        userId,
        query,
      })
      throw new SearchError("Failed to generate embedding for search query", "embedding_error", error.status || 500)
    }

    logger.error("Error performing semantic search", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
      query,
    })

    throw error
  }
}

/**
 * Performs hybrid search combining vector similarity and keyword matching
 *
 * @param query - Search query
 * @param userId - User ID
 * @param filter - Metadata filter
 * @param topK - Number of results to return
 * @returns Search results
 */
async function performHybridSearch(query: string, userId: string, filter: any, topK: number): Promise<any[]> {
  try {
    // Use the hybridSearch function from pinecone-rest-client
    const response = await hybridSearch(query, (text) => generateEmbedding(text), {
      filter,
      topK,
      alpha: 0.75, // Weight between vector and keyword search (0.75 = 75% vector, 25% keyword)
    })

    if (!response.matches || !Array.isArray(response.matches)) {
      return []
    }

    // Format results
    return response.matches.map((match) => {
      const content = match.metadata?.content || ""

      return {
        id: match.id,
        title: match.metadata?.document_name || "Unknown",
        content: content,
        documentId: match.metadata?.document_id || match.id,
        documentName: match.metadata?.document_name || "Unknown",
        documentType: match.metadata?.document_type || "Unknown",
        date: match.metadata?.created_at || new Date().toISOString(),
        relevance: match.score || 0,
        highlights: extractHighlights(content, query),
        chunkIndex: match.metadata?.chunk_index,
        totalChunks: match.metadata?.total_chunks,
        section: match.metadata?.section,
        sectionHeading: match.metadata?.section_heading,
      }
    })
  } catch (error) {
    logger.error("Error performing hybrid search", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
      query,
    })

    // Fall back to semantic search if hybrid search fails
    logger.info("Falling back to semantic search after hybrid search failure")
    return performSemanticSearch(query, userId, filter, topK)
  }
}

/**
 * Reranks search results to improve relevance
 *
 * @param results - Search results to rerank
 * @param query - Search query
 * @returns Reranked search results
 */
function rerank(results: any[], query: string): any[] {
  if (!results || results.length === 0) return []

  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2)

  // If no valid query terms, return results as is
  if (queryTerms.length === 0) return results

  return results
    .map((result) => {
      let score = result.relevance || 0
      const content = (result.content || "").toLowerCase()
      const title = (result.title || "").toLowerCase()

      // Boost score based on exact matches in title
      for (const term of queryTerms) {
        if (title.includes(term)) {
          score += 0.2
        }
      }

      // Boost score based on term frequency in content
      for (const term of queryTerms) {
        const regex = new RegExp(term, "gi")
        const matches = content.match(regex)
        if (matches) {
          score += Math.min(matches.length * 0.01, 0.1) // Cap at 0.1 boost
        }
      }

      // Boost score for documents with section headings that match query terms
      if (result.sectionHeading) {
        const headingLower = result.sectionHeading.toLowerCase()
        for (const term of queryTerms) {
          if (headingLower.includes(term)) {
            score += 0.15
          }
        }
      }

      // Normalize score to 0-1 range
      score = Math.min(score, 1)

      return {
        ...result,
        relevance: score,
      }
    })
    .sort((a, b) => b.relevance - a.relevance)
}

/**
 * Deduplicates search results based on content similarity
 *
 * @param results - Search results to deduplicate
 * @returns Deduplicated search results
 */
function deduplicateResults(results: any[]): any[] {
  if (!results || results.length <= 1) return results

  const deduplicated: any[] = []
  const seenContent = new Set<string>()

  for (const result of results) {
    // Create a content fingerprint (first 100 chars)
    const contentFingerprint = (result.content || "").substring(0, 100).trim()

    // Skip if we've seen very similar content
    if (contentFingerprint && contentFingerprint.length > 20) {
      if (seenContent.has(contentFingerprint)) continue
      seenContent.add(contentFingerprint)
    }

    deduplicated.push(result)
  }

  return deduplicated
}

/**
 * Paginates search results
 *
 * @param results - Search results to paginate
 * @param page - Page number (1-based)
 * @param pageSize - Page size
 * @returns Paginated search results and total count
 */
function paginateResults(results: any[], page: number, pageSize: number): { paginatedResults: any[]; total: number } {
  const total = results.length

  // Calculate start and end indices
  const start = (page - 1) * pageSize
  const end = start + pageSize

  // Slice results
  const paginatedResults = results.slice(start, end)

  return { paginatedResults, total }
}

/**
 * Logs search query for analytics
 *
 * @param userId - User ID
 * @param query - Search query
 * @param type - Search type
 * @param filters - Search filters
 * @param resultCount - Number of results
 */
async function logSearchQuery(
  userId: string,
  query: string,
  type: string,
  filters: any,
  resultCount: number,
): Promise<void> {
  try {
    const placeholderVector = createPlaceholderVector()

    await queryVectors([
      {
        id: `search_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        values: placeholderVector,
        metadata: {
          user_id: userId,
          query,
          search_type: type,
          filters: JSON.stringify(filters),
          result_count: resultCount,
          record_type: "search_history",
          created_at: new Date().toISOString(),
        },
      },
    ])

    logger.info("Search query logged successfully", {
      userId,
      query,
      type,
      resultCount,
    })
  } catch (error) {
    // Don't fail the search if logging fails
    logger.error("Error logging search query", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
      query,
    })
  }
}

/**
 * Main search handler for GET requests
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const userId = searchParams.get("userId")
      const query = searchParams.get("q")
      const type = (searchParams.get("type") as "semantic" | "keyword" | "hybrid") || "semantic"
      const topKParam = searchParams.get("topK")
      const topK = topKParam ? Number.parseInt(topKParam, 10) : DEFAULT_TOP_K
      const pageParam = searchParams.get("page")
      const page = pageParam ? Number.parseInt(pageParam, 10) : 1
      const pageSizeParam = searchParams.get("pageSize")
      const pageSize = pageSizeParam ? Number.parseInt(pageSizeParam, 10) : 10
      const useCache = searchParams.get("cache") !== "false"

      logger.info(`GET /api/search - Processing search request`, {
        userId,
        query,
        type,
        topK,
        page,
        pageSize,
        useCache,
      })

      // Validate search parameters
      validateSearchParams(userId, query, type, topK)

      // Parse document types
      const documentTypes = searchParams.getAll("documentType")

      // Parse sort option
      const sortBy = searchParams.get("sortBy") || undefined

      // Parse date range
      const from = searchParams.get("from")
      const to = searchParams.get("to")
      const dateRange = from || to ? {} : undefined

      if (from) {
        dateRange!.from = new Date(from)
      }

      if (to) {
        dateRange!.to = new Date(to)
      }

      // Build filter
      const filter: any = {
        user_id: { $eq: userId },
        record_type: { $eq: "chunk" },
      }

      if (documentTypes.length > 0) {
        filter.document_type = { $in: documentTypes }
      }

      // Add date range filter if provided
      if (dateRange) {
        if (dateRange.from) {
          filter.created_at = { ...filter.created_at, $gte: dateRange.from.toISOString() }
        }
        if (dateRange.to) {
          filter.created_at = { ...filter.created_at, $lte: dateRange.to.toISOString() }
        }
      }

      // Create filters object for logging and caching
      const filters = {
        documentTypes: documentTypes.length > 0 ? documentTypes : undefined,
        sortBy,
        dateRange,
      }

      // Check cache if enabled
      if (useCache) {
        const cacheKey = createCacheKey(userId!, query!, type, filters, page, pageSize)
        const cached = searchCache.get(cacheKey)

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          logger.info("Search cache hit", {
            userId,
            query,
            type,
          })

          return cached.results
        }
      }

      // Perform the search based on type
      try {
        let results: any[] = []

        switch (type) {
          case "semantic":
            results = await performSemanticSearch(query!, userId!, filter, topK)
            break

          case "keyword":
            results = await performKeywordSearch(query!, userId!, filter, topK)
            break

          case "hybrid":
            results = await performHybridSearch(query!, userId!, filter, topK)
            break

          default:
            results = await performSemanticSearch(query!, userId!, filter, topK)
        }

        // Rerank results to improve relevance
        const rerankedResults = rerank(results, query!)

        // Deduplicate results
        const dedupedResults = deduplicateResults(rerankedResults)

        // Apply sorting if specified
        const sortedResults = [...dedupedResults]
        if (sortBy === "date") {
          sortedResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        } else if (sortBy === "relevance") {
          // Already sorted by relevance from reranking
        }

        // Paginate results
        const { paginatedResults, total } = paginateResults(sortedResults, page, pageSize)

        // Log search query for analytics (don't await to avoid delaying response)
        logSearchQuery(userId!, query!, type, filters, total)

        // Prepare response
        const response = {
          results: paginatedResults,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        }

        // Store in cache if caching is enabled
        if (useCache) {
          const cacheKey = createCacheKey(userId!, query!, type, filters, page, pageSize)
          searchCache.set(cacheKey, {
            results: response,
            timestamp: Date.now(),
          })

          // Simple cache size management
          if (searchCache.size > 100) {
            const entries = Array.from(searchCache.entries())
            const oldestEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp).slice(0, 20) // Remove oldest 20 entries

            for (const [key] of oldestEntries) {
              searchCache.delete(key)
            }
          }
        }

        logger.info(`GET /api/search - Search completed successfully`, {
          userId,
          query,
          type,
          resultCount: total,
          returnedCount: paginatedResults.length,
        })

        return response
      } catch (searchError) {
        if (searchError instanceof SearchError) {
          throw searchError
        }

        if (searchError instanceof PineconeError) {
          logger.error("Pinecone error during search", {
            error: searchError.message,
            retryable: searchError.retryable,
            status: searchError.status,
            userId,
            query,
          })

          throw new SearchError("Vector database error during search", "vector_db_error", searchError.status || 500)
        }

        logger.error("GET /api/search - Error performing search", {
          error: searchError instanceof Error ? searchError.message : "Unknown error",
          userId,
          query,
        })

        throw new SearchError("An error occurred while processing your search", "search_error", 500)
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }

      if (error instanceof SearchError) {
        throw error
      }

      logger.error("GET /api/search - Unexpected error", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })

      throw new SearchError("An unexpected error occurred", "internal_error", 500)
    }
  }, request)
})

/**
 * Main search handler for POST requests
 * Allows for more complex search queries with request body
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      // Parse request body
      const body = await request.json()
      const {
        query,
        userId,
        type = "semantic",
        topK = DEFAULT_TOP_K,
        page = 1,
        pageSize = 10,
        filters = {},
        useCache = true,
      } = body

      logger.info(`POST /api/search - Processing search request`, {
        userId,
        query,
        type,
        topK,
        page,
        pageSize,
        useCache,
        filters,
      })

      // Validate search parameters
      validateSearchParams(userId, query, type, topK)

      // Extract filters
      const { documentTypes, dateRange, sortBy } = filters

      // Build filter
      const filter: any = {
        user_id: { $eq: userId },
        record_type: { $eq: "chunk" },
      }

      if (documentTypes && Array.isArray(documentTypes) && documentTypes.length > 0) {
        filter.document_type = { $in: documentTypes }
      }

      // Add date range filter if provided
      if (dateRange) {
        if (dateRange.from) {
          filter.created_at = { ...filter.created_at, $gte: new Date(dateRange.from).toISOString() }
        }
        if (dateRange.to) {
          filter.created_at = { ...filter.created_at, $lte: new Date(dateRange.to).toISOString() }
        }
      }

      // Add custom metadata filters if provided
      if (filters.metadata && typeof filters.metadata === "object") {
        for (const [key, value] of Object.entries(filters.metadata)) {
          // Skip null or undefined values
          if (value === null || value === undefined) continue

          // Handle different filter types
          if (Array.isArray(value)) {
            filter[key] = { $in: value }
          } else if (typeof value === "object") {
            filter[key] = value
          } else {
            filter[key] = { $eq: value }
          }
        }
      }

      // Check cache if enabled
      if (useCache) {
        const cacheKey = createCacheKey(userId, query, type, filters, page, pageSize)
        const cached = searchCache.get(cacheKey)

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          logger.info("Search cache hit", {
            userId,
            query,
            type,
          })

          return cached.results
        }
      }

      // Perform the search based on type
      try {
        let results: any[] = []

        switch (type) {
          case "semantic":
            results = await performSemanticSearch(query, userId, filter, topK)
            break

          case "keyword":
            results = await performKeywordSearch(query, userId, filter, topK)
            break

          case "hybrid":
            results = await performHybridSearch(query, userId, filter, topK)
            break

          default:
            results = await performSemanticSearch(query, userId, filter, topK)
        }

        // Rerank results to improve relevance
        const rerankedResults = rerank(results, query)

        // Deduplicate results
        const dedupedResults = deduplicateResults(rerankedResults)

        // Apply sorting if specified
        const sortedResults = [...dedupedResults]
        if (sortBy === "date") {
          sortedResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        } else if (sortBy === "relevance") {
          // Already sorted by relevance from reranking
        }

        // Paginate results
        const { paginatedResults, total } = paginateResults(sortedResults, page, pageSize)

        // Log search query for analytics (don't await to avoid delaying response)
        logSearchQuery(userId, query, type, filters, total)

        // Prepare response
        const response = {
          results: paginatedResults,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        }

        // Store in cache if caching is enabled
        if (useCache) {
          const cacheKey = createCacheKey(userId, query, type, filters, page, pageSize)
          searchCache.set(cacheKey, {
            results: response,
            timestamp: Date.now(),
          })
        }

        logger.info(`POST /api/search - Search completed successfully`, {
          userId,
          query,
          type,
          resultCount: total,
          returnedCount: paginatedResults.length,
        })

        return response
      } catch (searchError) {
        if (searchError instanceof SearchError) {
          throw searchError
        }

        if (searchError instanceof PineconeError) {
          logger.error("Pinecone error during search", {
            error: searchError.message,
            retryable: searchError.retryable,
            status: searchError.status,
            userId,
            query,
          })

          throw new SearchError("Vector database error during search", "vector_db_error", searchError.status || 500)
        }

        logger.error("POST /api/search - Error performing search", {
          error: searchError instanceof Error ? searchError.message : "Unknown error",
          userId,
          query,
        })

        throw new SearchError("An error occurred while processing your search", "search_error", 500)
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }

      if (error instanceof SearchError) {
        throw error
      }

      logger.error("POST /api/search - Unexpected error", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })

      throw new SearchError("An unexpected error occurred", "internal_error", 500)
    }
  }, request)
})
