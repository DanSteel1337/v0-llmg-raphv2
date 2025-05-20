/**
 * Chat Messages API Route
 *
 * Handles chat message operations including retrieval, creation and AI-powered responses.
 * Provides endpoints for fetching conversation messages and sending new messages.
 * Implements RAG (Retrieval Augmented Generation) using Pinecone for context.
 * 
 * Routes:
 * - GET: Retrieve messages for a conversation
 * - POST: Create a new message and generate AI response
 * 
 * Dependencies:
 * - Pinecone for vector storage and context retrieval
 * - OpenAI for embeddings and text generation
 * - Vercel Edge Runtime for serverless execution
 * 
 * @module app/api/chat/messages/route
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
import { NextResponse } from "next/server"

export const runtime = "edge"

/**
 * GET handler for fetching messages in a conversation
 */
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

/**
 * POST handler for creating a new message and generating an AI response
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      // Parse the request body with better error handling
      let body;
      try {
        body = await request.json();
      } catch (parseError) {
        logger.error("Failed to parse request body", { 
          error: parseError instanceof Error ? parseError.message : "Unknown error" 
        });
        throw new ValidationError("Invalid request body format - must be JSON");
      }

      // Validate all required fields before proceeding
      if (!body.conversationId || typeof body.conversationId !== 'string') {
        logger.error("Missing or invalid conversationId", { 
          providedValue: body.conversationId,
          type: typeof body.conversationId 
        });
        return NextResponse.json(
          { success: false, error: "conversationId is required and must be a string" },
          { status: 400 }
        );
      }

      if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
        logger.error("Missing or invalid content", { 
          providedContentType: typeof body.content,
          contentEmpty: typeof body.content === 'string' && body.content.trim() === '',
          contentLength: typeof body.content === 'string' ? body.content.length : 0
        });
        return NextResponse.json(
          { success: false, error: "content is required and must be a non-empty string" },
          { status: 400 }
        );
      }

      if (!body.userId || typeof body.userId !== 'string') {
        logger.error("Missing or invalid userId", { 
          providedValue: body.userId,
          type: typeof body.userId 
        });
        return NextResponse.json(
          { success: false, error: "userId is required and must be a string" },
          { status: 400 }
        );
      }

      const { conversationId, content, userId } = body;

      logger.info(`POST /api/chat/messages - Processing chat message`, {
        conversationId,
        userId,
        contentLength: content.length,
      })

      // Create user message
      const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const now = new Date().toISOString()

      // Generate embedding for the message with proper error handling
      let userEmbedding;
      try {
        userEmbedding = await generateEmbedding(content);
      } catch (embeddingError) {
        logger.error("Failed to generate embedding for user message", {
          error: embeddingError instanceof Error ? embeddingError.message : "Unknown error",
          contentSample: content.substring(0, 100) + (content.length > 100 ? "..." : "")
        });
        return NextResponse.json(
          { success: false, error: `Failed to generate embedding for user message: ${embeddingError.message}` },
          { status: 400 }
        );
      }

      // Store user message
      try {
        await upsertVectors([
          {
            id: userMessageId,
            values: userEmbedding,
            metadata: {
              conversation_id: conversationId,
              role: "user",
              content,
              user_id: userId,
              created_at: now,
              record_type: "message",
            },
          },
        ]);
      } catch (upsertError) {
        logger.error("Failed to store user message", {
          error: upsertError instanceof Error ? upsertError.message : "Unknown error",
          userMessageId
        });
        return NextResponse.json(
          { success: false, error: `Failed to store user message: ${upsertError.message}` },
          { status: 500 }
        );
      }

      logger.info(`POST /api/chat/messages - User message stored`, {
        conversationId,
        messageId: userMessageId,
      })

      // Generate AI response
      try {
        // Get relevant context using try-catch
        let contextResponse;
        try {
          contextResponse = await queryVectors(userEmbedding, 5, true, {
            user_id: { $eq: userId },
            record_type: { $eq: "chunk" },
          });
        } catch (contextError) {
          logger.error("Error querying context for message", {
            error: contextError instanceof Error ? contextError.message : "Unknown error"
          });
          // Use empty context instead of failing
          contextResponse = { matches: [] };
        }

        // Format context with validation
        const contextMatches = Array.isArray(contextResponse.matches) ? contextResponse.matches : [];
        let context = contextMatches.map((match) => ({
          content: match.metadata?.content || "",
          documentName: match.metadata?.document_name || "Unknown",
        }));

        // Ensure content is non-empty
        context = context.filter(item => item.content && typeof item.content === 'string' && item.content.trim() !== '');

        // Add fallback if no valid context found
        if (context.length === 0) {
          logger.warn("No valid context found for user query", { conversationId, userMessageId });
          context.push({
            content: "No relevant context found for this query.",
            documentName: "System"
          });
        }

        // Get conversation history
        let historyResponse;
        try {
          historyResponse = await queryVectors(createPlaceholderVector(), 10, true, {
            conversation_id: { $eq: conversationId },
            record_type: { $eq: "message" },
          });
        } catch (historyError) {
          logger.error("Error fetching conversation history", {
            error: historyError instanceof Error ? historyError.message : "Unknown error"
          });
          // Use empty history instead of failing
          historyResponse = { matches: [] };
        }

        // Format history with validation
        const historyMatches = Array.isArray(historyResponse.matches) ? historyResponse.matches : [];
        let history = historyMatches
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
          }));

        // Ensure we have valid history messages
        history = history.filter(msg => 
          msg.content && typeof msg.content === 'string' && msg.content.trim() !== '' &&
          msg.role && typeof msg.role === 'string' && (msg.role === 'user' || msg.role === 'assistant')
        );

        // Create system message with context
        const systemMessage = `You are a helpful assistant that answers questions based on the provided context. 
If the answer is not in the context, say that you don't know. 
Always cite your sources using [Document: Title] format at the end of relevant sentences.

Context:
${context.map((item) => `${item.content} [Document: ${item.documentName}]`).join("\n\n")}`

        // Generate response with proper error handling
        let responseContent = "";

        try {
          await streamText({
            model: openai("gpt-4o"),
            system: systemMessage,
            messages: history,
            temperature: 0.7,
            maxTokens: 1000,
            onChunk: ({ chunk }) => {
              if (chunk.type === "text-delta") {
                responseContent += chunk.text;
              }
            },
          });
        } catch (streamError) {
          logger.error("Error generating AI response", {
            error: streamError instanceof Error ? streamError.message : "Unknown error"
          });
          throw new Error(`Failed to generate AI response: ${streamError.message}`);
        }

        // Validate response content
        if (!responseContent || typeof responseContent !== 'string' || responseContent.trim() === '') {
          logger.error("Empty or invalid response from AI model", {
            conversationId,
            responseContentLength: responseContent ? responseContent.length : 0,
            contentType: typeof responseContent
          });
          throw new Error("Failed to generate valid AI response: received empty response");
        }

        // Extract sources
        const sources = context
          .map((item) => item.documentName)
          .filter((v, i, a) => a.indexOf(v) === i && v !== "System");

        // Generate embedding for response with error handling
        let responseEmbedding;
        try {
          responseEmbedding = await generateEmbedding(responseContent);
        } catch (embeddingError) {
          logger.error("Error generating embedding for AI response", {
            error: embeddingError instanceof Error ? embeddingError.message : "Unknown error",
            responseContentSample: responseContent.substring(0, 100) + "..."
          });
          
          // Use a placeholder embedding instead of failing
          responseEmbedding = createPlaceholderVector();
          logger.info("Using placeholder vector for assistant message due to embedding error");
        }

        // Store assistant message
        const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        try {
          await upsertVectors([
            {
              id: assistantMessageId,
              values: responseEmbedding,
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
          ]);
        } catch (upsertError) {
          logger.error("Failed to store assistant message", {
            error: upsertError instanceof Error ? upsertError.message : "Unknown error",
            assistantMessageId
          });
          throw new Error(`Failed to store assistant response: ${upsertError.message}`);
        }

        logger.info(`POST /api/chat/messages - Assistant response generated and stored`, {
          conversationId,
          messageId: assistantMessageId,
          responseLength: responseContent.length,
        });

        return {
          message: {
            id: assistantMessageId,
            conversation_id: conversationId,
            role: "assistant",
            content: responseContent,
            created_at: new Date().toISOString(),
            sources,
          },
        };
      } catch (error) {
        logger.error("Error generating AI response:", {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined
        });
        throw new Error(`Failed to generate AI response: ${error.message}`);
      }
    } catch (error) {
      logger.error("POST /api/chat/messages - Error processing message", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }, request);
});
