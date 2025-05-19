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

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      throw new Error("User ID is required")
    }

    const conversations = await getConversationsByUserId(userId)
    return { conversations }
  })
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()

    validateRequiredFields(body, ["userId", "title"])
    const { userId, title } = body

    const conversation = await createConversation(userId, title)
    return { conversation }
  })
})
