/**
 * Conversations API Route
 *
 * API endpoints for managing chat conversations.
 *
 * Dependencies:
 * - @/services/chat-service for conversation operations
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { createConversation, getConversationsByUserId } from "@/services/chat-service"
import { handleApiRequest, validateRequiredFields } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

// Ensure the Edge runtime is declared
export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const userId = searchParams.get("userId")

      console.log(`GET /api/conversations - Fetching conversations for user`, { userId })

      if (!userId) {
        console.error("GET /api/conversations - Missing userId parameter")
        throw new Error("User ID is required")
      }

      const conversations = await getConversationsByUserId(userId)
      console.log(`GET /api/conversations - Successfully fetched conversations`, {
        userId,
        conversationCount: conversations.length,
      })

      return { conversations }
    } catch (error) {
      console.error("GET /api/conversations - Error fetching conversations", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
      })
      throw error
    }
  })
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const body = await request.json()
      console.log(`POST /api/conversations - Creating conversation`, {
        userId: body.userId,
        title: body.title,
      })

      validateRequiredFields(body, ["userId", "title"])
      const { userId, title } = body

      const conversation = await createConversation(userId, title)
      console.log(`POST /api/conversations - Successfully created conversation`, {
        userId,
        conversationId: conversation.id,
      })

      return { conversation }
    } catch (error) {
      console.error("POST /api/conversations - Error creating conversation", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
      })
      throw error
    }
  })
})
