/**
 * Analytics API Route
 *
 * Provides analytics data about documents, searches, chats, and system usage.
 * This route is Edge-compatible and optimized for real-time analytics with efficient caching.
 *
 * Features:
 * - Comprehensive analytics data collection across multiple domains
 * - Time-series data with customizable date ranges
 * - Efficient data aggregation with caching
 * - Detailed breakdowns by status, type, and other dimensions
 * - Performance optimized for real-time dashboards
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/pinecone-rest-client for vector operations
 * - @/lib/utils/logger for structured logging
 * - @/lib/utils/validators for input validation
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { ValidationError } from "@/utils/validation"
import {
  queryVectors,
  createPlaceholderVector,
  describeIndexStats,
  type PineconeQueryMatch,
} from "@/lib/pinecone-rest-client"
import { logger } from "@/lib/utils/logger"
import { isValidDateString, isValidTimeRange } from "@/lib/utils/validators"

export const runtime = "edge"

// Maximum number of vectors to query
const MAX_VECTORS_PER_QUERY = 10000

// Cache TTL in seconds (5 minutes)
const CACHE_TTL = 300

// Analytics response types
interface AnalyticsResponse {
  success: boolean
  data?: AnalyticsData
  error?: string
  cached?: boolean
  timestamp: string
}

interface AnalyticsData {
  documents: DocumentAnalytics
  search: SearchAnalytics
  chat: ChatAnalytics
  system: SystemAnalytics
  mightBeTruncated: {
    documents: boolean
    chunks: boolean
    searches: boolean
    chats: boolean
  }
}

interface DocumentAnalytics {
  total: number
  byStatus: Record<string, number>
  byDate: TimeSeriesData[]
  processingTimes: {
    average: number
    min: number
    max: number
  }
  topDocuments: TopDocument[]
  chunkCount: number
  averageChunksPerDocument: number
}

interface SearchAnalytics {
  totalQueries: number
  popularTerms: PopularTerm[]
  averageResults: number
  byDate: TimeSeriesData[]
  resultDistribution: {
    noResults: number
    lowResults: number
    mediumResults: number
    highResults: number
  }
}

interface ChatAnalytics {
  totalConversations: number
  totalMessages: number
  byDate: TimeSeriesData[]
  averageLength: number
  messageDistribution: {
    user: number
    assistant: number
  }
  topConversations: TopConversation[]
}

interface SystemAnalytics {
  vectorCount: number
  embeddingRequests: number
  apiCalls: {
    total: number
    byEndpoint: Record<string, number>
  }
  indexStats: {
    totalVectorCount: number
    namespaceCount: number
    indexFullness: number
  }
}

interface TimeSeriesData {
  date: string
  value: number
}

interface TopDocument {
  id: string
  name: string
  chunkCount: number
  createdAt: string
}

interface PopularTerm {
  term: string
  count: number
}

interface TopConversation {
  id: string
  messageCount: number
  lastActive: string
}

// In-memory cache for analytics data
const analyticsCache = new Map<string, { data: AnalyticsData; timestamp: number }>()

/**
 * GET handler for analytics data
 *
 * Supports the following query parameters:
 * - userId: Required user ID
 * - timeRange: 'day' | 'week' | 'month' | 'custom' (default: 'week')
 * - startDate: ISO date string (required for custom range)
 * - endDate: ISO date string (required for custom range)
 * - type: 'documents' | 'search' | 'chat' | 'all' (default: 'all')
 * - detailed: boolean (return detailed breakdowns, default: false)
 * - skipCache: boolean (bypass cache, default: false)
 * - debug: boolean (include debug information, default: false)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const userId = searchParams.get("userId")
      const timeRange = searchParams.get("timeRange") || "week"
      const startDate = searchParams.get("startDate")
      const endDate = searchParams.get("endDate")
      const type = searchParams.get("type") || "all"
      const detailed = searchParams.get("detailed") === "true"
      const skipCache = searchParams.get("skipCache") === "true"
      const debug = searchParams.get("debug") === "true"

      logger.info(`GET /api/analytics - Fetching analytics for user`, {
        userId,
        timeRange,
        type,
        detailed,
        debug,
      })

      // Validate required parameters
      if (!userId) {
        throw new ValidationError("User ID is required")
      }

      // Validate time range
      if (!isValidTimeRange(timeRange)) {
        throw new ValidationError("Invalid time range. Must be one of: day, week, month, custom")
      }

      // Validate custom date range
      if (timeRange === "custom") {
        if (!startDate || !isValidDateString(startDate)) {
          throw new ValidationError("Valid startDate is required for custom time range")
        }
        if (!endDate || !isValidDateString(endDate)) {
          throw new ValidationError("Valid endDate is required for custom time range")
        }
      }

      // Validate type
      if (type !== "all" && type !== "documents" && type !== "search" && type !== "chat") {
        throw new ValidationError("Invalid type. Must be one of: documents, search, chat, all")
      }

      // Generate cache key based on request parameters
      const cacheKey = `${userId}:${timeRange}:${startDate || ""}:${endDate || ""}:${type}:${detailed}`

      // Check cache if not skipping
      if (!skipCache && analyticsCache.has(cacheKey)) {
        const cachedData = analyticsCache.get(cacheKey)!
        const cacheAge = Date.now() - cachedData.timestamp

        // Return cached data if it's still fresh
        if (cacheAge < CACHE_TTL * 1000) {
          logger.info(`GET /api/analytics - Returning cached data`, {
            userId,
            cacheAge: Math.round(cacheAge / 1000),
            ttl: CACHE_TTL,
          })

          return {
            success: true,
            data: cachedData.data,
            cached: true,
            timestamp: new Date(cachedData.timestamp).toISOString(),
          } as AnalyticsResponse
        }
      }

      // Calculate date filters based on time range
      const dateFilter = getDateFilter(timeRange, startDate, endDate)

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Prepare filter for user ID
      const userFilter = { user_id: userId }

      // Combine with date filter if applicable
      const baseFilter = dateFilter ? { ...userFilter, ...dateFilter } : userFilter

      // Fetch data based on requested type
      let documentData: PineconeQueryMatch[] = []
      let chunkData: PineconeQueryMatch[] = []
      let searchData: PineconeQueryMatch[] = []
      let chatData: PineconeQueryMatch[] = []
      let messageData: PineconeQueryMatch[] = []

      // Parallel data fetching for better performance
      const fetchPromises: Promise<any>[] = []

      if (type === "all" || type === "documents") {
        // Document data
        fetchPromises.push(
          queryVectors(placeholderVector, MAX_VECTORS_PER_QUERY, true, {
            ...baseFilter,
            record_type: "document",
          }).then((result) => {
            documentData = Array.isArray(result.matches) ? result.matches : []
          }),
        )

        // Chunk data
        fetchPromises.push(
          queryVectors(placeholderVector, MAX_VECTORS_PER_QUERY, true, {
            ...baseFilter,
            record_type: "chunk",
          }).then((result) => {
            chunkData = Array.isArray(result.matches) ? result.matches : []
          }),
        )
      }

      if (type === "all" || type === "search") {
        // Search data
        fetchPromises.push(
          queryVectors(placeholderVector, MAX_VECTORS_PER_QUERY, true, {
            ...baseFilter,
            record_type: "search_history",
          }).then((result) => {
            searchData = Array.isArray(result.matches) ? result.matches : []
          }),
        )
      }

      if (type === "all" || type === "chat") {
        // Conversation data
        fetchPromises.push(
          queryVectors(placeholderVector, MAX_VECTORS_PER_QUERY, true, {
            ...baseFilter,
            record_type: "conversation",
          }).then((result) => {
            chatData = Array.isArray(result.matches) ? result.matches : []
          }),
        )

        // Message data
        fetchPromises.push(
          queryVectors(placeholderVector, MAX_VECTORS_PER_QUERY, true, {
            ...baseFilter,
            record_type: "message",
          }).then((result) => {
            messageData = Array.isArray(result.matches) ? result.matches : []
          }),
        )
      }

      // Fetch index stats for system analytics
      let indexStats = {
        totalVectorCount: 0,
        namespaceCount: 0,
        indexFullness: 0,
      }

      if (type === "all") {
        fetchPromises.push(
          describeIndexStats()
            .then((stats) => {
              indexStats = {
                totalVectorCount: stats.totalVectorCount,
                namespaceCount: Object.keys(stats.namespaces || {}).length,
                indexFullness: stats.indexFullness,
              }
            })
            .catch((error) => {
              logger.warn("Failed to fetch index stats", {
                error: error instanceof Error ? error.message : "Unknown error",
              })
            }),
        )
      }

      // Wait for all data fetching to complete
      await Promise.all(fetchPromises)

      // Process document analytics
      const documentAnalytics = processDocumentAnalytics(documentData, chunkData, detailed)

      // Process search analytics
      const searchAnalytics = processSearchAnalytics(searchData, detailed)

      // Process chat analytics
      const chatAnalytics = processChatAnalytics(chatData, messageData, detailed)

      // Process system analytics
      const systemAnalytics = processSystemAnalytics(
        documentData,
        chunkData,
        searchData,
        messageData,
        indexStats,
        detailed,
      )

      // Combine all analytics data
      const analyticsData: AnalyticsData = {
        documents: documentAnalytics,
        search: searchAnalytics,
        chat: chatAnalytics,
        system: systemAnalytics,
        mightBeTruncated: {
          documents: documentData.length >= MAX_VECTORS_PER_QUERY,
          chunks: chunkData.length >= MAX_VECTORS_PER_QUERY,
          searches: searchData.length >= MAX_VECTORS_PER_QUERY,
          chats: messageData.length >= MAX_VECTORS_PER_QUERY,
        },
      }

      // Cache the results
      analyticsCache.set(cacheKey, {
        data: analyticsData,
        timestamp: Date.now(),
      })

      logger.info(`GET /api/analytics - Successfully fetched analytics data`, {
        userId,
        documentCount: documentData.length,
        searchCount: searchData.length,
        chatCount: chatData.length,
        chunkCount: chunkData.length,
      })

      return {
        success: true,
        data: analyticsData,
        cached: false,
        timestamp: new Date().toISOString(),
      } as AnalyticsResponse
    } catch (error) {
      logger.error("GET /api/analytics - Error fetching analytics", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})

/**
 * Generates a date filter object based on the specified time range
 */
function getDateFilter(
  timeRange: string,
  startDate: string | null,
  endDate: string | null,
): Record<string, any> | null {
  const now = new Date()
  let start: Date

  switch (timeRange) {
    case "day":
      // Last 24 hours
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case "week":
      // Last 7 days
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "month":
      // Last 30 days
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "custom":
      // Custom date range
      if (!startDate || !endDate) {
        return null
      }
      start = new Date(startDate)
      const end = new Date(endDate)

      // Add one day to end date to make it inclusive
      end.setDate(end.getDate() + 1)

      return {
        created_at: {
          $gte: start.toISOString(),
          $lt: end.toISOString(),
        },
      }
    default:
      return null
  }

  return {
    created_at: {
      $gte: start.toISOString(),
      $lt: now.toISOString(),
    },
  }
}

/**
 * Processes document data to generate document analytics
 */
function processDocumentAnalytics(
  documentData: PineconeQueryMatch[],
  chunkData: PineconeQueryMatch[],
  detailed: boolean,
): DocumentAnalytics {
  // Count documents by status
  const byStatus: Record<string, number> = {}

  // Track processing times
  let totalProcessingTime = 0
  let minProcessingTime = Number.POSITIVE_INFINITY
  let maxProcessingTime = 0
  let processedDocumentCount = 0

  // Group documents by date for time series
  const dateMap = new Map<string, number>()

  // Process each document
  documentData.forEach((doc) => {
    const metadata = doc.metadata || {}
    const status = metadata.status || "unknown"
    const createdAt = metadata.created_at || ""

    // Count by status
    byStatus[status] = (byStatus[status] || 0) + 1

    // Track processing time if available
    if (metadata.processing_time) {
      const processingTime = Number.parseFloat(metadata.processing_time)
      if (!isNaN(processingTime)) {
        totalProcessingTime += processingTime
        minProcessingTime = Math.min(minProcessingTime, processingTime)
        maxProcessingTime = Math.max(maxProcessingTime, processingTime)
        processedDocumentCount++
      }
    }

    // Group by date for time series
    if (createdAt) {
      const dateKey = createdAt.split("T")[0] // Extract YYYY-MM-DD
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
    }
  })

  // Calculate average processing time
  const averageProcessingTime = processedDocumentCount > 0 ? totalProcessingTime / processedDocumentCount : 0

  // Convert date map to sorted array for time series
  const byDate = Array.from(dateMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Get top documents by chunk count
  const topDocuments = documentData
    .map((doc) => {
      const metadata = doc.metadata || {}
      return {
        id: metadata.document_id || doc.id,
        name: metadata.name || "Unnamed Document",
        chunkCount: Number.parseInt(metadata.chunk_count) || 0,
        createdAt: metadata.created_at || "",
      }
    })
    .sort((a, b) => b.chunkCount - a.chunkCount)
    .slice(0, detailed ? 10 : 5)

  // Calculate average chunks per document
  const averageChunksPerDocument = documentData.length > 0 ? chunkData.length / documentData.length : 0

  return {
    total: documentData.length,
    byStatus,
    byDate,
    processingTimes: {
      average: averageProcessingTime,
      min: processedDocumentCount > 0 ? minProcessingTime : 0,
      max: maxProcessingTime,
    },
    topDocuments,
    chunkCount: chunkData.length,
    averageChunksPerDocument,
  }
}

/**
 * Processes search data to generate search analytics
 */
function processSearchAnalytics(searchData: PineconeQueryMatch[], detailed: boolean): SearchAnalytics {
  // Count search terms
  const termCount = new Map<string, number>()

  // Track result counts
  let totalResults = 0
  let noResultsCount = 0
  let lowResultsCount = 0
  let mediumResultsCount = 0
  let highResultsCount = 0

  // Group searches by date for time series
  const dateMap = new Map<string, number>()

  // Process each search
  searchData.forEach((search) => {
    const metadata = search.metadata || {}
    const query = metadata.query || ""
    const resultCount = Number.parseInt(metadata.result_count) || 0
    const createdAt = metadata.created_at || ""

    // Count search terms
    if (query) {
      termCount.set(query, (termCount.get(query) || 0) + 1)
    }

    // Track result distribution
    totalResults += resultCount
    if (resultCount === 0) {
      noResultsCount++
    } else if (resultCount <= 3) {
      lowResultsCount++
    } else if (resultCount <= 10) {
      mediumResultsCount++
    } else {
      highResultsCount++
    }

    // Group by date for time series
    if (createdAt) {
      const dateKey = createdAt.split("T")[0] // Extract YYYY-MM-DD
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
    }
  })

  // Calculate average results per search
  const averageResults = searchData.length > 0 ? totalResults / searchData.length : 0

  // Convert date map to sorted array for time series
  const byDate = Array.from(dateMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Get popular search terms
  const popularTerms = Array.from(termCount.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, detailed ? 20 : 10)

  return {
    totalQueries: searchData.length,
    popularTerms,
    averageResults,
    byDate,
    resultDistribution: {
      noResults: noResultsCount,
      lowResults: lowResultsCount,
      mediumResults: mediumResultsCount,
      highResults: highResultsCount,
    },
  }
}

/**
 * Processes chat data to generate chat analytics
 */
function processChatAnalytics(
  chatData: PineconeQueryMatch[],
  messageData: PineconeQueryMatch[],
  detailed: boolean,
): ChatAnalytics {
  // Count messages by role
  let userMessages = 0
  let assistantMessages = 0

  // Track conversation lengths
  const conversationLengths = new Map<string, number>()

  // Group chats by date for time series
  const dateMap = new Map<string, number>()

  // Process each message
  messageData.forEach((message) => {
    const metadata = message.metadata || {}
    const role = metadata.role || ""
    const conversationId = metadata.conversation_id || ""
    const createdAt = metadata.created_at || ""

    // Count by role
    if (role === "user") {
      userMessages++
    } else if (role === "assistant") {
      assistantMessages++
    }

    // Track conversation lengths
    if (conversationId) {
      conversationLengths.set(conversationId, (conversationLengths.get(conversationId) || 0) + 1)
    }

    // Group by date for time series
    if (createdAt) {
      const dateKey = createdAt.split("T")[0] // Extract YYYY-MM-DD
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
    }
  })

  // Calculate average conversation length
  const averageLength = conversationLengths.size > 0 ? messageData.length / conversationLengths.size : 0

  // Convert date map to sorted array for time series
  const byDate = Array.from(dateMap.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Get top conversations by message count
  const topConversations = Array.from(conversationLengths.entries())
    .map(([id, count]) => {
      // Find the conversation to get last active time
      const conversation = chatData.find((c) => c.metadata?.conversation_id === id || c.id === id)
      return {
        id,
        messageCount: count,
        lastActive: conversation?.metadata?.updated_at || conversation?.metadata?.created_at || "",
      }
    })
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, detailed ? 10 : 5)

  return {
    totalConversations: conversationLengths.size,
    totalMessages: messageData.length,
    byDate,
    averageLength,
    messageDistribution: {
      user: userMessages,
      assistant: assistantMessages,
    },
    topConversations,
  }
}

/**
 * Processes system data to generate system analytics
 */
function processSystemAnalytics(
  documentData: PineconeQueryMatch[],
  chunkData: PineconeQueryMatch[],
  searchData: PineconeQueryMatch[],
  messageData: PineconeQueryMatch[],
  indexStats: {
    totalVectorCount: number
    namespaceCount: number
    indexFullness: number
  },
  detailed: boolean,
): SystemAnalytics {
  // Count API calls by endpoint
  const endpointCalls: Record<string, number> = {
    "/api/documents": documentData.length,
    "/api/search": searchData.length,
    "/api/chat/messages": messageData.length,
    "/api/embeddings": chunkData.length,
  }

  // Estimate embedding requests (each chunk and search requires an embedding)
  const embeddingRequests = chunkData.length + searchData.length

  return {
    vectorCount: documentData.length + chunkData.length + searchData.length + messageData.length,
    embeddingRequests,
    apiCalls: {
      total: Object.values(endpointCalls).reduce((sum, count) => sum + count, 0),
      byEndpoint: endpointCalls,
    },
    indexStats,
  }
}
