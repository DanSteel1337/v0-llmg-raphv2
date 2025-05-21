/**
 * Conversations API Route
 *
 * Handles conversation operations including creation, listing, and batch deletion.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/validation for input validation
 * - @/lib/utils/logger for logging
 * - @/lib/pinecone-rest-client for vector operations
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { ValidationError, validateRequiredFields } from "@/utils/validation"
import { logger } from "@/lib/utils/logger"
import { queryVectors, createPlaceholderVector, upsertVectors, deleteVectors } from "@/lib/pinecone-rest-client"
import type { Conversation } from "@/types"

export const runtime = "edge"

// Conversation filter interface
interface ConversationFilters {
  userId?: string
  startDate?: string
  endDate?: string
  tags?: string[]
  folder?: string
  searchTerm?: string
}

// Conversation sort options
type SortField = "created_at" | "updated_at" | "title" | "message_count"
type SortDirection = "asc" | "desc"

/**
 * GET handler for listing conversations
 * Supports filtering, sorting, and pagination
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)

      // Extract query parameters
      const userId = searchParams.get("userId")
      const limit = Number.parseInt(searchParams.get("limit") || "20", 10)
      const offset = Number.parseInt(searchParams.get("offset") || "0", 10)
      const sortBy = (searchParams.get("sortBy") || "updated_at") as SortField
      const sortDirection = (searchParams.get("sortDirection") || "desc") as SortDirection
      const startDate = searchParams.get("startDate") || undefined
      const endDate = searchParams.get("endDate") || undefined
      const tags = searchParams.get("tags") ? searchParams.get("tags")?.split(",") : undefined
      const folder = searchParams.get("folder") || undefined
      const searchTerm = searchParams.get("search") || undefined

      logger.info(`GET /api/conversations - Fetching conversations`, {
        userId,
        limit,
        offset,
        sortBy,
        sortDirection,
      })

      if (!userId) {
        throw new ValidationError("User ID is required")
      }

      // Validate pagination parameters
      if (limit > 100) {
        throw new ValidationError("Limit cannot exceed 100")
      }

      if (offset < 0) {
        throw new ValidationError("Offset cannot be negative")
      }

      // Build filter for Pinecone query
      const filter: Record<string, any> = {
        user_id: { $eq: userId },
        record_type: { $eq: "conversation" },
      }

      // Add date filters if provided
      if (startDate) {
        filter.created_at = filter.created_at || {}
        filter.created_at.$gte = startDate
      }

      if (endDate) {
        filter.created_at = filter.created_at || {}
        filter.created_at.$lte = endDate
      }

      // Add tags filter if provided
      if (tags && tags.length > 0) {
        filter.tags = { $in: tags }
      }

      // Add folder filter if provided
      if (folder) {
        filter.folder = { $eq: folder }
      }

      // Add search term filter if provided
      if (searchTerm) {
        // This is a simplified approach - in a real implementation,
        // you might want to use a more sophisticated search mechanism
        filter.$or = [{ title: { $contains: searchTerm } }, { last_message: { $contains: searchTerm } }]
      }

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Query Pinecone for conversations
      const response = await queryVectors(placeholderVector, limit + 1, true, filter)

      // Ensure matches is an array
      const matches = Array.isArray(response.matches) ? response.matches : []

      // Check if there are more results
      const hasMore = matches.length > limit
      const paginatedMatches = matches.slice(0, limit)

      // Format conversations
      const conversations = paginatedMatches.map((match) => ({
        id: match.id,
        user_id: match.metadata?.user_id || "",
        title: match.metadata?.title || "New Conversation",
        created_at: match.metadata?.created_at || new Date().toISOString(),
        updated_at: match.metadata?.updated_at || new Date().toISOString(),
        message_count: match.metadata?.message_count || 0,
        tags: match.metadata?.tags || [],
        folder: match.metadata?.folder || null,
        last_message: match.metadata?.last_message || null,
        is_pinned: match.metadata?.is_pinned || false,
      }))

      // Sort conversations based on requested sort field and direction
      conversations.sort((a, b) => {
        let comparison: number

        switch (sortBy) {
          case "title":
            comparison = a.title.localeCompare(b.title)
            break
          case "message_count":
            comparison = a.message_count - b.message_count
            break
          case "created_at":
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            break
          case "updated_at":
          default:
            comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
            break
        }

        return sortDirection === "asc" ? comparison : -comparison
      })

      logger.info(`GET /api/conversations - Successfully fetched conversations`, {
        userId,
        conversationCount: conversations.length,
        hasMore,
      })

      // Get total count for pagination info
      const countResponse = await queryVectors(placeholderVector, 0, false, {
        user_id: { $eq: userId },
        record_type: { $eq: "conversation" },
      })

      const totalCount = countResponse.matches?.length || 0

      return {
        conversations,
        pagination: {
          total: totalCount,
          offset,
          limit,
          hasMore,
        },
      }
    } catch (error) {
      logger.error("GET /api/conversations - Error fetching conversations", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})

/**
 * POST handler for creating a new conversation
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const body = await request.json()

      validateRequiredFields(body, ["userId", "title"], "Conversation creation")
      const { userId, title, tags = [], folder = null } = body

      logger.info(`POST /api/conversations - Creating conversation`, {
        userId,
        title,
        tags,
        folder,
      })

      // Generate a unique ID
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const now = new Date().toISOString()

      // Create conversation metadata
      const conversation: Conversation = {
        id: conversationId,
        user_id: userId,
        title: title || "New Conversation",
        created_at: now,
        updated_at: now,
        message_count: 0,
        tags,
        folder,
        last_message: null,
        is_pinned: false,
      }

      // Create a placeholder vector for storage
      const placeholderVector = createPlaceholderVector()

      // Store in Pinecone
      await upsertVectors([
        {
          id: conversationId,
          values: placeholderVector,
          metadata: {
            ...conversation,
            record_type: "conversation",
          },
        },
      ])

      logger.info(`POST /api/conversations - Successfully created conversation`, {
        userId,
        conversationId,
      })

      return { conversation }
    } catch (error) {
      logger.error("POST /api/conversations - Error creating conversation", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})

/**
 * DELETE handler for batch deleting conversations
 */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const body = await request.json()

      validateRequiredFields(body, ["conversationIds"], "Conversation batch deletion")
      const { conversationIds } = body

      if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
        throw new ValidationError("conversationIds must be a non-empty array")
      }

      logger.info(`DELETE /api/conversations - Batch deleting conversations`, {
        count: conversationIds.length,
      })

      // Delete the conversations
      await deleteVectors(conversationIds)

      // Find all messages for these conversations
      const placeholderVector = createPlaceholderVector()

      for (const conversationId of conversationIds) {
        const response = await queryVectors(placeholderVector, 1000, false, {
          conversation_id: { $eq: conversationId },
          record_type: { $eq: "message" },
        })

        // Delete all messages for this conversation
        if (response.matches && response.matches.length > 0) {
          const messageIds = response.matches.map((match) => match.id)
          await deleteVectors(messageIds)

          logger.info(
            `DELETE /api/conversations - Deleted ${messageIds.length} messages for conversation ${conversationId}`,
          )
        }
      }

      logger.info(`DELETE /api/conversations - Successfully deleted ${conversationIds.length} conversations`)

      return {
        success: true,
        deletedCount: conversationIds.length,
      }
    } catch (error) {
      logger.error("DELETE /api/conversations - Error batch deleting conversations", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
