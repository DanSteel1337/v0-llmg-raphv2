/**
 * Chat Messages API Route
 *
 * Handles chat message operations including retrieval, creation and AI-powered responses.
 * Provides endpoints for fetching conversation messages and sending new messages.
 * Implements RAG (Retrieval Augmented Generation) using Pinecone for context.
 *
 * Routes:
 * - GET: Retrieve messages for a conversation with pagination
 * - POST: Create a new message and generate AI response with streaming
 *
 * Dependencies:
 * - Pinecone for vector storage and context retrieval
 * - OpenAI for embeddings and text generation
 * - Vercel Edge Runtime for serverless execution
 *
 * @module app/api/chat/messages/route
 */

import type { NextRequest } from "next/server"
import { StreamingTextResponse, type Message } from "ai"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { ValidationError } from "@/utils/validation"
import { logger } from "@/lib/utils/logger"
import { queryVectors, createPlaceholderVector, upsertVectors, hybridSearch } from "@/lib/pinecone-rest-client"
import { generateEmbedding } from "@/lib/embedding-service"
import { openai } from "@ai-sdk/openai"
import { NextResponse } from "next/server"
import { streamText } from "@/lib/streamText" // Import streamText

// Ensure Edge Runtime compatibility
export const runtime = "edge"

// Define conversation modes
type ConversationMode = "chat" | "qa" | "analysis"

// Define message source interface
interface MessageSource {
  id: string
  documentName: string
  documentId: string
  chunkId: string
  score: number
  content: string
  metadata?: Record<string, any>
}

// Define context retrieval options
interface ContextOptions {
  maxResults?: number
  minScore?: number
  includeMetadata?: boolean
  filterByDocuments?: string[]
  filterByDate?: {
    start?: string
    end?: string
  }
  hybridSearch?: boolean
  reranking?: boolean
}

/**
 * GET handler for fetching messages in a conversation with pagination
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    try {
      const { searchParams } = new URL(request.url)
      const conversationId = searchParams.get("conversationId")
      const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
      const offset = Number.parseInt(searchParams.get("offset") || "0", 10)
      const includeMetadata = searchParams.get("includeMetadata") === "true"

      logger.info(`GET /api/chat/messages - Fetching messages`, {
        conversationId,
        limit,
        offset,
        includeMetadata,
      })

      if (!conversationId) {
        throw new ValidationError("Conversation ID is required")
      }

      // Validate pagination parameters
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new ValidationError("Invalid limit parameter (must be between 1 and 100)")
      }

      if (isNaN(offset) || offset < 0) {
        throw new ValidationError("Invalid offset parameter (must be >= 0)")
      }

      // Create a placeholder vector for querying
      const placeholderVector = createPlaceholderVector()

      // Query Pinecone for messages with pagination
      const response = await queryVectors(placeholderVector, limit + 1, true, {
        conversation_id: { $eq: conversationId },
        record_type: { $eq: "message" },
      })

      // Ensure matches is an array
      const matches = Array.isArray(response.matches) ? response.matches : []

      // Format messages with enhanced metadata
      const messages = matches.map((match) => {
        // Base message properties
        const message = {
          id: match.id,
          conversation_id: match.metadata?.conversation_id || "",
          role: match.metadata?.role || "user",
          content: match.metadata?.content || "",
          created_at: match.metadata?.created_at || new Date().toISOString(),
          sources: match.metadata?.sources || [],
        }

        // Add additional metadata if requested
        if (includeMetadata && match.metadata) {
          return {
            ...message,
            metadata: {
              ...match.metadata,
              // Remove duplicate fields already in the message
              conversation_id: undefined,
              role: undefined,
              content: undefined,
              created_at: undefined,
              sources: undefined,
            },
          }
        }

        return message
      })

      // Sort by creation time
      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      // Apply pagination
      const paginatedMessages = messages.slice(offset, offset + limit)
      const hasMore = messages.length > limit

      logger.info(`GET /api/chat/messages - Successfully fetched messages`, {
        conversationId,
        messageCount: paginatedMessages.length,
        hasMore,
        totalAvailable: hasMore ? offset + messages.length : offset + paginatedMessages.length,
      })

      return {
        messages: paginatedMessages,
        pagination: {
          offset,
          limit,
          hasMore,
          total: hasMore ? -1 : offset + paginatedMessages.length, // -1 indicates unknown total
        },
      }
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
 * Retrieves relevant context from Pinecone based on the query
 *
 * @param query - User query to find context for
 * @param userId - User ID for filtering documents
 * @param embedding - Pre-computed embedding for the query
 * @param options - Context retrieval options
 * @returns Array of context items with content and metadata
 */
async function retrieveContext(
  query: string,
  userId: string,
  embedding: number[],
  options: ContextOptions = {},
): Promise<MessageSource[]> {
  const {
    maxResults = 5,
    minScore = 0.7,
    includeMetadata = true,
    filterByDocuments = [],
    filterByDate,
    hybridSearch: useHybridSearch = true,
    reranking = true,
  } = options

  logger.info(`Retrieving context for query`, {
    queryLength: query.length,
    userId,
    maxResults,
    minScore,
    filterByDocuments: filterByDocuments.length,
    useHybridSearch,
    reranking,
  })

  try {
    // Build metadata filter
    const filter: Record<string, any> = {
      user_id: { $eq: userId },
      record_type: { $eq: "chunk" },
    }

    // Add document filter if specified
    if (filterByDocuments.length > 0) {
      filter.document_id = { $in: filterByDocuments }
    }

    // Add date filter if specified
    if (filterByDate) {
      const dateFilter: Record<string, any> = {}
      if (filterByDate.start) {
        dateFilter.$gte = filterByDate.start
      }
      if (filterByDate.end) {
        dateFilter.$lte = filterByDate.end
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.created_at = dateFilter
      }
    }

    // Perform vector search
    let searchResponse

    if (useHybridSearch && query.trim().length > 0) {
      // Use hybrid search for better results when query is non-empty
      searchResponse = await hybridSearch(
        query,
        async (text) => embedding, // Use pre-computed embedding
        {
          filter,
          topK: maxResults * 2, // Get more results for reranking
          namespace: "",
          alpha: 0.75, // Balance between vector and keyword search
        },
      )
    } else {
      // Use standard vector search
      searchResponse = await queryVectors(embedding, {
        topK: maxResults * 2, // Get more results for reranking
        includeMetadata,
        includeValues: false,
        filter,
        namespace: "",
      })
    }

    // Ensure matches is an array
    const matches = Array.isArray(searchResponse.matches) ? searchResponse.matches : []

    if (matches.length === 0) {
      logger.warn("No context matches found for query", {
        queryLength: query.length,
        userId,
      })
      return []
    }

    // Process and format matches
    let contextItems = matches
      .filter((match) => match.score && match.score >= minScore)
      .map((match) => {
        // Extract document and chunk information
        const documentId = match.metadata?.document_id || ""
        const documentName = match.metadata?.document_name || "Unknown"
        const content = match.metadata?.content || ""
        const chunkId = match.id || ""
        const score = match.score || 0

        // Create context item
        return {
          id: `src_${chunkId}`,
          documentName,
          documentId,
          chunkId,
          score,
          content,
          metadata: includeMetadata ? match.metadata : undefined,
        }
      })
      .filter((item) => item.content && item.content.trim() !== "")

    // Apply reranking if enabled and we have enough results
    if (reranking && contextItems.length > maxResults) {
      // Simple reranking: boost items that contain exact query terms
      const queryTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 3)

      if (queryTerms.length > 0) {
        contextItems = contextItems.map((item) => {
          const content = item.content.toLowerCase()
          let termMatches = 0

          // Count term matches
          queryTerms.forEach((term) => {
            if (content.includes(term)) {
              termMatches++
            }
          })

          // Boost score based on term matches
          const termBoost = termMatches > 0 ? (termMatches / queryTerms.length) * 0.2 : 0
          const newScore = Math.min(1, item.score + termBoost)

          return {
            ...item,
            score: newScore,
            reranked: true,
          }
        })

        // Re-sort by adjusted score
        contextItems.sort((a, b) => b.score - a.score)
      }
    }

    // Limit to requested number of results
    contextItems = contextItems.slice(0, maxResults)

    logger.info(`Retrieved ${contextItems.length} context items`, {
      topScore: contextItems.length > 0 ? contextItems[0].score : 0,
      bottomScore: contextItems.length > 0 ? contextItems[contextItems.length - 1].score : 0,
      documentCount: new Set(contextItems.map((item) => item.documentId)).size,
    })

    return contextItems
  } catch (error) {
    logger.error("Error retrieving context", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Return empty array instead of failing
    return []
  }
}

/**
 * Retrieves conversation history from Pinecone
 *
 * @param conversationId - ID of the conversation
 * @param limit - Maximum number of messages to retrieve
 * @returns Array of messages in the conversation
 */
async function getConversationHistory(conversationId: string, limit = 10): Promise<Message[]> {
  try {
    logger.info(`Retrieving conversation history`, {
      conversationId,
      limit,
    })

    // Query Pinecone for conversation history
    const historyResponse = await queryVectors(createPlaceholderVector(), {
      topK: limit * 2, // Get more to ensure we have enough valid messages
      includeMetadata: true,
      includeValues: false,
      filter: {
        conversation_id: { $eq: conversationId },
        record_type: { $eq: "message" },
      },
    })

    // Ensure matches is an array
    const historyMatches = Array.isArray(historyResponse.matches) ? historyResponse.matches : []

    if (historyMatches.length === 0) {
      logger.info("No conversation history found", { conversationId })
      return []
    }

    // Format history with validation
    let history = historyMatches
      .map((match) => ({
        role: match.metadata?.role || "user",
        content: match.metadata?.content || "",
        created_at: match.metadata?.created_at || "",
      }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-limit) // Get last N messages
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))

    // Ensure we have valid history messages
    history = history.filter(
      (msg) =>
        msg.content &&
        typeof msg.content === "string" &&
        msg.content.trim() !== "" &&
        msg.role &&
        typeof msg.role === "string" &&
        (msg.role === "user" || msg.role === "assistant"),
    )

    logger.info(`Retrieved ${history.length} conversation history messages`, {
      conversationId,
    })

    return history
  } catch (error) {
    logger.error("Error retrieving conversation history", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Return empty array instead of failing
    return []
  }
}

/**
 * Constructs an optimized system prompt based on context and conversation mode
 *
 * @param context - Retrieved context items
 * @param mode - Conversation mode (chat, qa, analysis)
 * @param options - Additional prompt options
 * @returns Optimized system prompt
 */
function constructSystemPrompt(
  context: MessageSource[],
  mode: ConversationMode = "chat",
  options: {
    includeSources?: boolean
    detailedCitations?: boolean
    userInstructions?: string
  } = {},
): string {
  const { includeSources = true, detailedCitations = true, userInstructions = "" } = options

  // Base instructions based on mode
  let baseInstructions = ""

  switch (mode) {
    case "qa":
      baseInstructions = `You are a precise question-answering assistant. 
Your goal is to provide accurate, factual answers based solely on the provided context.
If the answer is not in the context, say "I don't have enough information to answer this question."
Be concise and direct in your responses.`
      break

    case "analysis":
      baseInstructions = `You are an analytical assistant that helps users understand their documents.
Your goal is to provide thoughtful analysis and insights based on the provided context.
Synthesize information from multiple sources when possible.
If asked about something not in the context, say "I don't have enough information to analyze this topic."`
      break

    case "chat":
    default:
      baseInstructions = `You are a helpful assistant that answers questions based on the provided context.
Your goal is to be informative, relevant, and engaging.
If the answer is not in the context, say that you don't know or don't have enough information.
Be conversational but precise in your responses.`
      break
  }

  // Citation instructions based on options
  let citationInstructions = ""

  if (includeSources) {
    if (detailedCitations) {
      citationInstructions = `
Always cite your sources using [Document: Title] format at the end of sentences that use information from that source.
If information comes from multiple sources, cite all of them like [Document: Title1, Title2].
At the end of your response, list all sources used with their titles.`
    } else {
      citationInstructions = `
Reference information from the context when relevant.
At the end of your response, list the sources you used.`
    }
  }

  // Format context for the prompt
  const contextText =
    context.length > 0
      ? context
          .map((item, index) => {
            const sourcePrefix = `[${index + 1}] Document: ${item.documentName}`
            return `${sourcePrefix}\n${item.content}`
          })
          .join("\n\n")
      : "No relevant context found for this query."

  // Add user instructions if provided
  const customInstructions = userInstructions ? `\nUser-specific instructions: ${userInstructions}` : ""

  // Construct the final prompt
  return `${baseInstructions}${customInstructions}${citationInstructions}

Context:
${contextText}`
}

/**
 * Extracts and formats sources from context items
 *
 * @param context - Retrieved context items
 * @returns Array of unique source names
 */
function extractSources(context: MessageSource[]): string[] {
  return [
    ...new Set(
      context.map((item) => item.documentName).filter((name) => name && name !== "Unknown" && name !== "System"),
    ),
  ]
}

/**
 * POST handler for creating a new message and generating an AI response with streaming
 */
export const POST = async (request: NextRequest) => {
  try {
    // Parse the request body with better error handling
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      logger.error("Failed to parse request body", {
        error: parseError instanceof Error ? parseError.message : "Unknown error",
      })
      return NextResponse.json({ success: false, error: "Invalid request body format - must be JSON" }, { status: 400 })
    }

    // Extract and validate required fields
    const {
      content,
      conversationId,
      userId,
      mode = "chat" as ConversationMode,
      references = true,
      contextOptions = {},
      streaming = true,
    } = body

    // Validate required fields
    if (!conversationId || typeof conversationId !== "string") {
      logger.error("Missing or invalid conversationId", {
        providedValue: conversationId,
        type: typeof conversationId,
      })
      return NextResponse.json(
        { success: false, error: "conversationId is required and must be a string" },
        { status: 400 },
      )
    }

    if (!content || typeof content !== "string" || content.trim() === "") {
      logger.error("Missing or invalid content", {
        providedContentType: typeof content,
        contentEmpty: typeof content === "string" && content.trim() === "",
        contentLength: typeof content === "string" ? content.length : 0,
      })
      return NextResponse.json(
        { success: false, error: "content is required and must be a non-empty string" },
        { status: 400 },
      )
    }

    if (!userId || typeof userId !== "string") {
      logger.error("Missing or invalid userId", {
        providedValue: userId,
        type: typeof userId,
      })
      return NextResponse.json({ success: false, error: "userId is required and must be a string" }, { status: 400 })
    }

    // Validate mode if provided
    if (mode && !["chat", "qa", "analysis"].includes(mode)) {
      logger.error("Invalid conversation mode", { providedMode: mode })
      return NextResponse.json({ success: false, error: "mode must be one of: chat, qa, analysis" }, { status: 400 })
    }

    logger.info(`POST /api/chat/messages - Processing chat message`, {
      conversationId,
      userId,
      contentLength: content.length,
      mode,
      references,
      streaming,
    })

    // Create user message
    const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()

    // Generate embedding for the message with proper error handling
    let userEmbedding
    try {
      userEmbedding = await generateEmbedding(content)
    } catch (embeddingError) {
      logger.error("Failed to generate embedding for user message", {
        error: embeddingError instanceof Error ? embeddingError.message : "Unknown error",
        contentSample: content.substring(0, 100) + (content.length > 100 ? "..." : ""),
      })
      return NextResponse.json(
        {
          success: false,
          error: `Failed to generate embedding for user message: ${embeddingError instanceof Error ? embeddingError.message : "Unknown error"}`,
        },
        { status: 400 },
      )
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
      ])
    } catch (upsertError) {
      logger.error("Failed to store user message", {
        error: upsertError instanceof Error ? upsertError.message : "Unknown error",
        userMessageId,
      })
      return NextResponse.json(
        {
          success: false,
          error: `Failed to store user message: ${upsertError instanceof Error ? upsertError.message : "Unknown error"}`,
        },
        { status: 500 },
      )
    }

    logger.info(`User message stored`, {
      conversationId,
      messageId: userMessageId,
    })

    // Retrieve relevant context
    const context = await retrieveContext(content, userId, userEmbedding, {
      ...contextOptions,
      maxResults: contextOptions.maxResults || 5,
      minScore: contextOptions.minScore || 0.7,
      hybridSearch: contextOptions.hybridSearch !== false,
      reranking: contextOptions.reranking !== false,
    })

    // Get conversation history
    const history = await getConversationHistory(conversationId, 10)

    // Add the current user message to history
    const updatedHistory = [...history, { role: "user" as const, content }]

    // Construct system prompt
    const systemPrompt = constructSystemPrompt(context, mode, {
      includeSources: references,
      detailedCitations: references && mode === "qa",
      userInstructions: body.instructions,
    })

    // Extract sources for metadata
    const sources = extractSources(context)

    // For streaming responses
    if (streaming) {
      try {
        // Create a streaming response
        const stream = await streamText({
          model: openai("gpt-4o"),
          system: systemPrompt,
          messages: updatedHistory,
          temperature: mode === "analysis" ? 0.7 : mode === "qa" ? 0.3 : 0.5,
          maxTokens: 2000,
        })

        // Create a TransformStream to capture the full response
        const fullResponseChunks: string[] = []

        const transformStream = new TransformStream({
          transform(chunk, controller) {
            // Pass the chunk through
            controller.enqueue(chunk)

            // Also capture it for storage
            if (typeof chunk === "string") {
              fullResponseChunks.push(chunk)
            } else if (chunk instanceof Uint8Array) {
              fullResponseChunks.push(new TextDecoder().decode(chunk))
            }
          },

          async flush(controller) {
            // When the stream is done, store the complete response
            try {
              const fullResponse = fullResponseChunks.join("")

              if (fullResponse.trim() !== "") {
                // Generate embedding for response
                let responseEmbedding
                try {
                  responseEmbedding = await generateEmbedding(fullResponse)
                } catch (embeddingError) {
                  logger.error("Error generating embedding for AI response", {
                    error: embeddingError instanceof Error ? embeddingError.message : "Unknown error",
                  })

                  // Use a placeholder embedding instead of failing
                  responseEmbedding = createPlaceholderVector()
                }

                // Store assistant message
                const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

                await upsertVectors([
                  {
                    id: assistantMessageId,
                    values: responseEmbedding,
                    metadata: {
                      conversation_id: conversationId,
                      role: "assistant",
                      content: fullResponse,
                      user_id: userId,
                      created_at: new Date().toISOString(),
                      sources,
                      mode,
                      context_count: context.length,
                      record_type: "message",
                    },
                  },
                ])

                logger.info(`Assistant response stored`, {
                  conversationId,
                  messageId: assistantMessageId,
                  responseLength: fullResponse.length,
                  sourceCount: sources.length,
                })
              }
            } catch (error) {
              // Log error but don't fail the response stream
              logger.error("Error storing assistant response", {
                error: error instanceof Error ? error.message : "Unknown error",
              })
            }
          },
        })

        // Return the streaming response
        return new StreamingTextResponse(stream.pipeThrough(transformStream))
      } catch (streamError) {
        logger.error("Error generating streaming AI response", {
          error: streamError instanceof Error ? streamError.message : "Unknown error",
        })
        return NextResponse.json(
          {
            success: false,
            error: `Failed to generate AI response: ${streamError instanceof Error ? streamError.message : "Unknown error"}`,
          },
          { status: 500 },
        )
      }
    }
    // For non-streaming responses
    else {
      try {
        // Generate complete response
        let responseContent = ""

        await streamText({
          model: openai("gpt-4o"),
          system: systemPrompt,
          messages: updatedHistory,
          temperature: mode === "analysis" ? 0.7 : mode === "qa" ? 0.3 : 0.5,
          maxTokens: 2000,
          onChunk: ({ chunk }) => {
            if (chunk.type === "text-delta") {
              responseContent += chunk.text
            }
          },
        })

        // Validate response content
        if (!responseContent || typeof responseContent !== "string" || responseContent.trim() === "") {
          logger.error("Empty or invalid response from AI model", {
            conversationId,
            responseContentLength: responseContent ? responseContent.length : 0,
            contentType: typeof responseContent,
          })
          return NextResponse.json(
            { success: false, error: "Failed to generate valid AI response: received empty response" },
            { status: 500 },
          )
        }

        // Generate embedding for response
        let responseEmbedding
        try {
          responseEmbedding = await generateEmbedding(responseContent)
        } catch (embeddingError) {
          logger.error("Error generating embedding for AI response", {
            error: embeddingError instanceof Error ? embeddingError.message : "Unknown error",
            responseContentSample: responseContent.substring(0, 100) + "...",
          })

          // Use a placeholder embedding instead of failing
          responseEmbedding = createPlaceholderVector()
        }

        // Store assistant message
        const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

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
              mode,
              context_count: context.length,
              record_type: "message",
            },
          },
        ])

        logger.info(`Assistant response generated and stored`, {
          conversationId,
          messageId: assistantMessageId,
          responseLength: responseContent.length,
          sourceCount: sources.length,
        })

        // Return the complete response
        return NextResponse.json({
          success: true,
          message: {
            id: assistantMessageId,
            conversation_id: conversationId,
            role: "assistant",
            content: responseContent,
            created_at: new Date().toISOString(),
            sources,
          },
          context: references
            ? context.map((c) => ({
                documentName: c.documentName,
                documentId: c.documentId,
                score: c.score,
              }))
            : undefined,
        })
      } catch (error) {
        logger.error("Error generating AI response:", {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        })
        return NextResponse.json(
          {
            success: false,
            error: `Failed to generate AI response: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
          { status: 500 },
        )
      }
    }
  } catch (error) {
    logger.error("POST /api/chat/messages - Error processing message", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      {
        success: false,
        error: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}
