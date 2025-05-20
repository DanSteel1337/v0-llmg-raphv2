/**
 * Conversation API Route
 *
 * Handles operations on a specific conversation.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/utils/logger for logging
 * - @/lib/pinecone-rest-client for vector operations
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { logger } from "@/lib/utils/logger"
import { queryVectors, deleteVectors } from "@/lib/pinecone-rest-client"

export const runtime = "edge"

export const DELETE = withErrorHandling(async (request: NextRequest, { params }: { params: { id: string } }) => {
  return handleApiRequest(async () => {
    try {
      const conversationId = params.id

      logger.info(`DELETE /api/conversations/${conversationId} - Deleting conversation`)

      if (!conversationId) {
        throw new Error("Conversation ID is required")
      }

      // Delete the conversation
      await deleteVectors([conversationId])

      // Find all messages for this conversation
      const response = await queryVectors(
        Array(3072).fill(0.001), // Placeholder vector
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
