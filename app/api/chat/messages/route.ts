/**
 * Chat Messages API Route
 *
 * Handles chat message operations including retrieval and generation.
 * This route is Edge-compatible and works with Vercel's serverless environment.
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/utils/validation for input validation
 * - @/lib/utils/logger for logging
 * - ai and @ai-sdk/openai for text generation
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { ValidationError, validateRequiredFields } from "@/utils/validation"
import { logger } from "@/lib/utils/logger"
import { queryVectors, createPlaceholderVector, upsertVectors } from "@/lib/pinecone-rest-client"
import { generateEmbedding } from "@/lib/embedding-service"
import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const conversationId = searchParams.get("conversationId")

      logger.info(`GET /api/chat/messages - Fetching messages`, { conversationId })

      if (!conversationId) {
        throw new ValidationError("Conversation ID is required")
      }

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Query Pinecone for messages
      const response = await queryVectors(placeholderVector, 100, true, {
        conversation_id: { $eq: conversationId },
        record_type: { $eq: "message" },
      })

      // Ensure matches is an array
      const matches = Array.isArray(response.matches) ? response.matches : []

      // Format messages
      const messages = matches.map((match) => ({
        id: match.id,
        conversation_id: match.metadata?.conversation_id || "",
        role: match.metadata?.role || "user",
        content: match.metadata?.content || "",
        created_at: match.metadata?.created_at || new Date().toISOString(),
        sources: match.metadata?.sources || [],
      }))

      // Sort by creation time
      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      logger.info(`GET /api/chat/messages - Successfully fetched messages`, {
        conversationId,
        messageCount: messages.length,
      })

      return { messages }
    } catch (error) {
      logger.error("GET /api/chat/messages - Error fetching messages", {
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

      validateRequiredFields(body, ["conversationId", "content", "userId"], "Chat message")
      const { conversationId, content, userId } = body

      logger.info(`POST /api/chat/messages - Processing chat message`, {
        conversationId,
        userId,
        contentLength: content.length,
      })

      // Create user message
      const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const now = new Date().toISOString()

      // Generate embedding for the message
      const embedding = await generateEmbedding(content)

      // Store user message
      await upsertVectors([
        {
          id: userMessageId,
          values: embedding,
          metadata: {
            conversation_id: conversationId,
            role: "user",
            content,
            user_id: userId,
            created_at: now,
            record_type: "message",
          },
        },
      ])

      logger.info(`POST /api/chat/messages - User message stored`, {
        conversationId,
        messageId: userMessageId,
      })

      // Generate AI response
      try {
        // Get relevant context
        const contextResponse = await queryVectors(embedding, 5, true, {
          user_id: { $eq: userId },
          record_type: { $eq: "chunk" },
        })

        // Format context
        const contextMatches = Array.isArray(contextResponse.matches) ? contextResponse.matches : []
        const context = contextMatches.map((match) => ({
          content: match.metadata?.content || "",
          documentName: match.metadata?.document_name || "Unknown",
        }))

        // Get conversation history
        const historyResponse = await queryVectors(createPlaceholderVector(), 10, true, {
          conversation_id: { $eq: conversationId },
          record_type: { $eq: "message" },
        })

        // Format history
        const historyMatches = Array.isArray(historyResponse.matches) ? historyResponse.matches : []
        const history = historyMatches
          .map((match) => ({
            role: match.metadata?.role || "user",
            content: match.metadata?.content || "",
            created_at: match.metadata?.created_at || "",
          }))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(-5) // Get last 5 messages
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))

        // Create system message with context
        const systemMessage = `You are a helpful assistant that answers questions based on the provided context. 
If the answer is not in the context, say that you don't know. 
Always cite your sources using [Document: Title] format at the end of relevant sentences.

Context:
${context.map((item) => `${item.content} [Document: ${item.documentName}]`).join("\n\n")}`

        // Generate response
        let responseContent = ""

        await streamText({
          model: openai("gpt-4o"),
          system: systemMessage,
          messages: history,
          temperature: 0.7,
          maxTokens: 1000,
          onChunk: ({ chunk }) => {
            if (chunk.type === "text-delta") {
              responseContent += chunk.text
            }
          },
        })

        // Extract sources
        const sources = context.map((item) => item.documentName).filter((v, i, a) => a.indexOf(v) === i)

        // Store assistant message
        const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        await upsertVectors([
          {
            id: assistantMessageId,
            values: await generateEmbedding(responseContent),
            metadata: {
              conversation_id: conversationId,
              role: "assistant",
              content: responseContent,
              user_id: userId,
              created_at: new Date().toISOString(),
              sources,
              record_type: "message",
            },
          },
        ])

        logger.info(`POST /api/chat/messages - Assistant response generated and stored`, {
          conversationId,
          messageId: assistantMessageId,
          responseLength: responseContent.length,
        })

        return {
          message: {
            id: assistantMessageId,
            conversation_id: conversationId,
            role: "assistant",
            content: responseContent,
            created_at: new Date().toISOString(),
            sources,
          },
        }
      } catch (error) {
        logger.error("Error generating AI response:", error)
        throw new Error(`Failed to generate AI response: ${error.message}`)
      }
    } catch (error) {
      logger.error("POST /api/chat/messages - Error processing message", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }, request)
})
