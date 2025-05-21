/**
 * Conversation API Route
 *
 * Handles operations on a specific conversation.
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
import { ValidationError } from "@/utils/validation"
import { logger } from "@/lib/utils/logger"
import { queryVectors, fetchVectors, upsertVectors, deleteVectors } from "@/lib/pinecone-rest-client"
import type { Conversation } from "@/types"

export const runtime = "edge"

/**
 * GET handler for retrieving a specific conversation with its messages
 */
export const GET = withErrorHandling(async (request: NextRequest, { params }: { params: { id: string } }) => {
  return handleApiRequest(async () => {
    try {
      const conversationId = params.id
      const { searchParams } = new URL(request.url)

      // Extract query parameters
      const includeMessages = searchParams.get("includeMessages") === "true"
      const messageLimit = Number.parseInt(searchParams.get("messageLimit") || "50", 10)
      const messageOffset = Number.parseInt(searchParams.get("messageOffset") || "0", 10)
      const includeVectorContext = searchParams.get("includeVectorContext") === "true"

      logger.info(`GET /api/conversations/${conversationId} - Retrieving conversation`, {
        includeMessages,
        messageLimit,
        messageOffset,
      })

      if (!conversationId) {
        throw new ValidationError("Conversation ID is required")
      }

      // Fetch the conversation
      const conversationResult = await fetchVectors([conversationId])

      if (!conversationResult.vectors || !conversationResult.vectors[conversationId]) {
        throw new ValidationError(`Conversation not found: ${conversationId}`, 404)
      }

      const conversationVector = conversationResult.vectors[conversationId]
      const metadata = conversationVector.metadata || {}

      // Format the conversation
      const conversation: Conversation = {
        id: conversationId,
        user_id: metadata.user_id || "",
        title: metadata.title || "Untitled Conversation",
        created_at: metadata.created_at || new Date().toISOString(),
        updated_at: metadata.updated_at || new Date().toISOString(),
        message_count: metadata.message_count || 0,
        tags: metadata.tags || [],
        folder: metadata.folder || null,
        last_message: metadata.last_message || null,
        is_pinned: metadata.is_pinned || false,
      }

      // If messages are not requested, return just the conversation
      if (!includeMessages) {
        return { conversation }
      }

      // Fetch messages for this conversation
      const placeholderVector = Array(conversationVector.values.length).fill(0.001)

      const messagesResponse = await queryVectors(placeholderVector, messageLimit + 1, true, {
        conversation_id: { $eq: conversationId },
        record_type: { $eq: "message" },
      })

      // Ensure matches is an array
      const matches = Array.isArray(messagesResponse.matches) ? messagesResponse.matches : []

      // Check if there are more messages
      const hasMoreMessages = matches.length > messageLimit
      const paginatedMatches = matches.slice(0, messageLimit)

      // Format messages
      const messages = paginatedMatches.map((match) => {
        const metadata = match.metadata || {}

        return {
          id: match.id,
          conversation_id: conversationId,
          role: metadata.role || "user",
          content: metadata.content || "",
          created_at: metadata.created_at || new Date().toISOString(),
          sources: metadata.sources || [],
          vector_context: includeVectorContext ? match.values : undefined,
          metadata: {
            token_count: metadata.token_count,
            embedding_model: metadata.embedding_model,
            completion_model: metadata.completion_model,
            ...(metadata.additional_metadata || {}),
          },
        }
      })

      // Sort messages by creation date (oldest first)
      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      logger.info(
        `GET /api/conversations/${conversationId} - Successfully retrieved conversation with ${messages.length} messages`,
      )

      return {
        conversation,
        messages,
        pagination: {
          total: conversation.message_count,
          offset: messageOffset,
          limit: messageLimit,
          hasMore: hasMoreMessages,
        },
      }
    } catch (error) {
      logger.error(`GET /api/conversations/${params.id} - Error retrieving conversation`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})

/**
 * PUT handler for updating conversation metadata
 */
export const PUT = withErrorHandling(async (request: NextRequest, { params }: { params: { id: string } }) => {
  return handleApiRequest(async () => {
    try {
      const conversationId = params.id
      const body = await request.json()

      logger.info(`PUT /api/conversations/${conversationId} - Updating conversation`)

      if (!conversationId) {
        throw new ValidationError("Conversation ID is required")
      }

      // Fetch the existing conversation
      const conversationResult = await fetchVectors([conversationId])

      if (!conversationResult.vectors || !conversationResult.vectors[conversationId]) {
        throw new ValidationError(`Conversation not found: ${conversationId}`, 404)
      }

      const existingVector = conversationResult.vectors[conversationId]
      const existingMetadata = existingVector.metadata || {}

      // Update the metadata
      const updatedMetadata = {
        ...existingMetadata,
        ...body,
        updated_at: new Date().toISOString(),
        // Ensure these fields aren't overwritten with invalid values
        id: conversationId,
        record_type: "conversation",
      }

      // Update in Pinecone
      await upsertVectors([
        {
          id: conversationId,
          values: existingVector.values,
          metadata: updatedMetadata,
        },
      ])

      // Format the updated conversation
      const updatedConversation: Conversation = {
        id: conversationId,
        user_id: updatedMetadata.user_id || "",
        title: updatedMetadata.title || "Untitled Conversation",
        created_at: updatedMetadata.created_at || new Date().toISOString(),
        updated_at: updatedMetadata.updated_at || new Date().toISOString(),
        message_count: updatedMetadata.message_count || 0,
        tags: updatedMetadata.tags || [],
        folder: updatedMetadata.folder || null,
        last_message: updatedMetadata.last_message || null,
        is_pinned: updatedMetadata.is_pinned || false,
      }

      logger.info(`PUT /api/conversations/${conversationId} - Successfully updated conversation`)

      return { conversation: updatedConversation }
    } catch (error) {
      logger.error(`PUT /api/conversations/${params.id} - Error updating conversation`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})

/**
 * PATCH handler for partial updates to conversation metadata
 */
export const PATCH = withErrorHandling(async (request: NextRequest, { params }: { params: { id: string } }) => {
  return handleApiRequest(async () => {
    try {
      const conversationId = params.id
      const body = await request.json()

      logger.info(`PATCH /api/conversations/${conversationId} - Partially updating conversation`)

      if (!conversationId) {
        throw new ValidationError("Conversation ID is required")
      }

      // Fetch the existing conversation
      const conversationResult = await fetchVectors([conversationId])

      if (!conversationResult.vectors || !conversationResult.vectors[conversationId]) {
        throw new ValidationError(`Conversation not found: ${conversationId}`, 404)
      }

      const existingVector = conversationResult.vectors[conversationId]
      const existingMetadata = existingVector.metadata || {}

      // Handle special operations
      if (body.addTags && Array.isArray(body.addTags)) {
        const currentTags = existingMetadata.tags || []
        body.tags = [...new Set([...currentTags, ...body.addTags])]
        delete body.addTags
      }

      if (body.removeTags && Array.isArray(body.removeTags)) {
        const currentTags = existingMetadata.tags || []
        body.tags = currentTags.filter((tag: string) => !body.removeTags.includes(tag))
        delete body.removeTags
      }

      // Update the metadata
      const updatedMetadata = {
        ...existingMetadata,
        ...body,
        updated_at: new Date().toISOString(),
        // Ensure these fields aren't overwritten with invalid values
        id: conversationId,
        record_type: "conversation",
      }

      // Update in Pinecone
      await upsertVectors([
        {
          id: conversationId,
          values: existingVector.values,
          metadata: updatedMetadata,
        },
      ])

      // Format the updated conversation
      const updatedConversation: Conversation = {
        id: conversationId,
        user_id: updatedMetadata.user_id || "",
        title: updatedMetadata.title || "Untitled Conversation",
        created_at: updatedMetadata.created_at || new Date().toISOString(),
        updated_at: updatedMetadata.updated_at || new Date().toISOString(),
        message_count: updatedMetadata.message_count || 0,
        tags: updatedMetadata.tags || [],
        folder: updatedMetadata.folder || null,
        last_message: updatedMetadata.last_message || null,
        is_pinned: updatedMetadata.is_pinned || false,
      }

      logger.info(`PATCH /api/conversations/${conversationId} - Successfully updated conversation`)

      return { conversation: updatedConversation }
    } catch (error) {
      logger.error(`PATCH /api/conversations/${params.id} - Error updating conversation`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})

/**
 * DELETE handler for deleting a specific conversation
 */
export const DELETE = withErrorHandling(async (request: NextRequest, { params }: { params: { id: string } }) => {
  return handleApiRequest(async () => {
    try {
      const conversationId = params.id

      logger.info(`DELETE /api/conversations/${conversationId} - Deleting conversation`)

      if (!conversationId) {
        throw new ValidationError("Conversation ID is required")
      }

      // Delete the conversation
      await deleteVectors([conversationId])

      // Find all messages for this conversation
      const placeholderVector = Array(3072).fill(0.001) // Placeholder vector
      const response = await queryVectors(
        placeholderVector,
        1000,
        false, // We don't need metadata
        {
          conversation_id: { $eq: conversationId },
          record_type: { $eq: "message" },
        },
      )

      // Delete all messages
      if (response.matches && response.matches.length > 0) {
        const messageIds = response.matches.map((match) => match.id)
        await deleteVectors(messageIds)

        logger.info(`DELETE /api/conversations/${conversationId} - Deleted ${messageIds.length} messages`)
      }

      logger.info(`DELETE /api/conversations/${conversationId} - Successfully deleted conversation`)

      return { success: true }
    } catch (error) {
      logger.error(`DELETE /api/conversations/${params.id} - Error deleting conversation`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
