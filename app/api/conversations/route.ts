/**
 * Conversations API Route
 *
 * Handles conversation operations including creation and retrieval.
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
import { queryVectors, createPlaceholderVector, upsertVectors } from "@/lib/pinecone-rest-client"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const userId = searchParams.get("userId")

      logger.info(`GET /api/conversations - Fetching conversations`, { userId })

      if (!userId) {
        throw new ValidationError("User ID is required")
      }

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Query Pinecone for conversations
      const response = await queryVectors(placeholderVector, 100, true, {
        user_id: { $eq: userId },
        record_type: { $eq: "conversation" },
      })

      // Ensure matches is an array
      const matches = Array.isArray(response.matches) ? response.matches : []

      // Format conversations
      const conversations = matches.map((match) => ({
        id: match.id,
        user_id: match.metadata?.user_id || "",
        title: match.metadata?.title || "New Conversation",
        created_at: match.metadata?.created_at || new Date().toISOString(),
        updated_at: match.metadata?.updated_at || new Date().toISOString(),
        message_count: match.metadata?.message_count || 0,
      }))

      // Sort by updated_at (most recent first)
      conversations.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

      logger.info(`GET /api/conversations - Successfully fetched conversations`, {
        userId,
        conversationCount: conversations.length,
      })

      return { conversations }
    } catch (error) {
      logger.error("GET /api/conversations - Error fetching conversations", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const body = await request.json()

      validateRequiredFields(body, ["userId", "title"], "Conversation creation")
      const { userId, title } = body

      logger.info(`POST /api/conversations - Creating conversation`, {
        userId,
        title,
      })

      // Generate a unique ID
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const now = new Date().toISOString()

      // Create conversation metadata
      const conversation = {
        id: conversationId,
        user_id: userId,
        title: title || "New Conversation",
        created_at: now,
        updated_at: now,
        message_count: 0,
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
