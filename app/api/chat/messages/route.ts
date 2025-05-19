/**
 * Chat Messages API Route
 *
 * API endpoints for managing chat messages.
 *
 * Dependencies:
 * - @/services/chat-service for chat operations
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { getMessagesByConversationId, createMessage, generateResponse } from "@/services/chat-service"
import { handleApiRequest, validateRequiredFields } from "@/lib/api-utils"
import { withErrorHandling } from "@/lib/error-handler"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversationId")

    if (!conversationId) {
      throw new Error("Conversation ID is required")
    }

    const messages = await getMessagesByConversationId(conversationId)
    return { messages }
  })
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()

    validateRequiredFields(body, ["conversationId", "content", "userId"])
    const { conversationId, content, userId } = body

    // Create user message
    await createMessage({
      conversationId,
      role: "user",
      content,
    })

    // Generate AI response
    const response = await generateResponse(conversationId, content, userId)

    return { message: response }
  })
})
