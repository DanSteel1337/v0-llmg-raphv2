/**
 * Chat Service
 *
 * Handles chat functionality including:
 * - Conversation management
 * - Message generation with RAG
 * - Context retrieval from vector store
 * - Chat history storage
 *
 * Dependencies:
 * - @/lib/pinecone-rest-client.ts for vector storage and retrieval
 * - @/lib/embedding-service.ts for embeddings
 * - ai for text generation
 * - uuid for ID generation
 */

import { v4 as uuidv4 } from "uuid"
import { upsertVectors, queryVectors, deleteVectors } from "@/lib/pinecone-rest-client"
import { generateEmbedding } from "@/lib/embedding-service"
import { VECTOR_DIMENSION } from "@/lib/embedding-config"
import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import type { ChatMessage, Conversation, CreateMessageOptions } from "@/types"

// Constants
const DEFAULT_TOP_K = 5
const MAX_HISTORY_MESSAGES = 10
const SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided context. 
If the answer is not in the context, say that you don't know. 
Always cite your sources using [Document: Title] format at the end of relevant sentences.`

/**
 * Creates a new conversation
 */
export async function createConversation(userId: string, title?: string): Promise<Conversation> {
  const conversationId = uuidv4()
  const now = new Date().toISOString()

  const conversation: Conversation = {
    id: conversationId,
    user_id: userId,
    title: title || "New Conversation",
    created_at: now,
    updated_at: now,
    message_count: 0,
  }

  // Create a zero vector with the correct dimension
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

  await upsertVectors([
    {
      id: conversationId,
      values: zeroVector, // Zero vector with correct dimension
      metadata: {
        ...conversation,
        record_type: "conversation",
      },
    },
  ])

  return conversation
}

/**
 * Gets conversation count for a user
 */
export async function getConversationCountByUserId(userId: string): Promise<number> {
  try {
    // Create a zero vector with the correct dimension
    const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

    // Query Pinecone for conversations with the specified user_id
    const response = await queryVectors(
      zeroVector,
      10000, // Use a high limit, but be aware of potential truncation
      true,
      {
        user_id: { $eq: userId },
        record_type: { $eq: "conversation" },
      },
    )

    // Handle potential error from Pinecone
    if ("error" in response && response.error) {
      console.error("Error getting conversation count from Pinecone:", response)
      return 0 // Return 0 as fallback
    }

    return response.matches?.length || 0
  } catch (error) {
    console.error("Error getting conversation count:", error)
    return 0
  }
}

/**
 * Gets all conversations for a user
 */
export async function getConversationsByUserId(userId: string): Promise<Conversation[]> {
  // Create a zero vector with the correct dimension
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

  const response = await queryVectors(
    zeroVector, // Zero vector with correct dimension
    100,
    true,
    {
      user_id: { $eq: userId },
      record_type: { $eq: "conversation" },
    },
  )

  // Handle potential error from Pinecone
  if ("error" in response && response.error) {
    console.error("Error querying conversations from Pinecone:", response)
    return [] // Return empty array as fallback
  }

  return (response.matches || []).map((match) => ({
    id: match.id,
    user_id: match.metadata?.user_id as string,
    title: match.metadata?.title as string,
    created_at: match.metadata?.created_at as string,
    updated_at: match.metadata?.updated_at as string,
    message_count: match.metadata?.message_count as number,
  }))
}

/**
 * Gets a conversation by ID
 */
export async function getConversationById(id: string): Promise<Conversation | null> {
  // Create a zero vector with the correct dimension
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

  const response = await queryVectors(
    zeroVector, // Zero vector with correct dimension
    1,
    true,
    {
      id: { $eq: id },
      record_type: { $eq: "conversation" },
    },
  )

  // Handle potential error from Pinecone
  if ("error" in response && response.error) {
    console.error("Error querying conversation from Pinecone:", response)
    return null // Return null as fallback
  }

  if (!response.matches || response.matches.length === 0) {
    return null
  }

  const match = response.matches[0]

  return {
    id: match.id,
    user_id: match.metadata?.user_id as string,
    title: match.metadata?.title as string,
    created_at: match.metadata?.created_at as string,
    updated_at: match.metadata?.updated_at as string,
    message_count: match.metadata?.message_count as number,
  }
}

/**
 * Updates a conversation's title
 */
export async function updateConversationTitle(id: string, title: string): Promise<Conversation> {
  // Get current conversation
  const conversation = await getConversationById(id)

  if (!conversation) {
    throw new Error("Conversation not found")
  }

  const updatedConversation = {
    ...conversation,
    title,
    updated_at: new Date().toISOString(),
  }

  // Create a zero vector with the correct dimension
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

  await upsertVectors([
    {
      id,
      values: zeroVector, // Zero vector with correct dimension
      metadata: {
        ...updatedConversation,
        record_type: "conversation",
      },
    },
  ])

  return updatedConversation
}

/**
 * Deletes a conversation and all its messages
 */
export async function deleteConversation(id: string): Promise<void> {
  // Delete the conversation
  await deleteVectors([id])

  // Create a zero vector with the correct dimension
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

  // Find all messages for this conversation
  const response = await queryVectors(
    zeroVector, // Zero vector with correct dimension
    1000,
    true,
    {
      conversation_id: { $eq: id },
      record_type: { $eq: "message" },
    },
  )

  // Delete all messages
  if (response.matches && response.matches.length > 0) {
    const messageIds = response.matches.map((match) => match.id)
    await deleteVectors(messageIds)
  }
}

/**
 * Gets all messages for a conversation
 */
export async function getMessagesByConversationId(conversationId: string): Promise<ChatMessage[]> {
  // Create a zero vector with the correct dimension
  const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

  const response = await queryVectors(
    zeroVector, // Zero vector with correct dimension
    100,
    true,
    {
      conversation_id: { $eq: conversationId },
      record_type: { $eq: "message" },
    },
  )

  // Handle potential error from Pinecone
  if ("error" in response && response.error) {
    console.error("Error querying messages from Pinecone:", response)
    return [] // Return empty array as fallback
  }

  const messages = (response.matches || []).map((match) => ({
    id: match.id,
    conversation_id: match.metadata?.conversation_id as string,
    role: match.metadata?.role as "user" | "assistant" | "system",
    content: match.metadata?.content as string,
    created_at: match.metadata?.created_at as string,
    sources: match.metadata?.sources as string[] | undefined,
  }))

  // Sort messages by creation time
  return messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

/**
 * Creates a new message in a conversation
 */
export async function createMessage({
  conversationId,
  role,
  content,
  sources,
  turnIndex,
}: CreateMessageOptions): Promise<ChatMessage> {
  // Use the correct ID format for chat messages
  const messageId =
    turnIndex !== undefined ? `mem_${conversationId}_${turnIndex}` : `mem_${conversationId}_${Date.now()}`

  const now = new Date().toISOString()

  const message: ChatMessage = {
    id: messageId,
    conversation_id: conversationId,
    role,
    content,
    created_at: now,
    sources,
  }

  // Generate embedding for the message content
  const embedding = await generateEmbedding(content)

  // Store message with embedding
  await upsertVectors([
    {
      id: messageId,
      values: embedding,
      metadata: {
        ...message,
        record_type: "message",
      },
    },
  ])

  // Update conversation message count and updated_at
  const conversation = await getConversationById(conversationId)
  if (conversation) {
    // Create a zero vector with the correct dimension
    const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

    await upsertVectors([
      {
        id: conversationId,
        values: zeroVector, // Zero vector with correct dimension
        metadata: {
          ...conversation,
          message_count: conversation.message_count + 1,
          updated_at: now,
          record_type: "conversation",
        },
      },
    ])
  }

  return message
}

/**
 * Generates a response to a user message using RAG
 */
export async function generateResponse(
  conversationId: string,
  userMessage: string,
  userId: string,
): Promise<ChatMessage> {
  try {
    // 1. Retrieve relevant context from vector store
    const context = await retrieveRelevantContext(userMessage, userId)

    // 2. Get conversation history
    const history = await getMessagesByConversationId(conversationId)
    const recentHistory = history.slice(-MAX_HISTORY_MESSAGES).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // 3. Create system message with context
    const systemMessage = `${SYSTEM_PROMPT}

Context:
${context.map((item) => `${item.content} [Document: ${item.documentName}]`).join("\n\n")}`

    // 4. Generate response using AI SDK's streamText
    try {
      console.log("Generating response with AI SDK streamText...")

      let responseContent = ""
      const turnIndex = history.length

      const result = await streamText({
        model: openai("gpt-4o"),
        system: systemMessage,
        messages: recentHistory,
        temperature: 0.7,
        maxTokens: 1000,
        onChunk: ({ chunk }) => {
          if (chunk.type === "text-delta") {
            responseContent += chunk.text
          }
        },
      })

      // Extract unique document names from context
      const sources: string[] = []
      context.forEach((item) => {
        if (!sources.includes(item.documentName)) {
          sources.push(item.documentName)
        }
      })

      // 5. Save assistant response
      const assistantMessage = await createMessage({
        conversationId,
        role: "assistant",
        content: responseContent,
        sources,
        turnIndex,
      })

      return assistantMessage
    } catch (error) {
      console.error("Error in OpenAI API call:", error)

      // Log detailed error information
      if (error.response) {
        console.error("OpenAI API Error Status:", error.response.status)
        console.error("OpenAI API Error Data:", error.response.data)
      }

      throw new Error(`OpenAI API error: ${error.message}`)
    }
  } catch (error) {
    console.error("Error generating response:", error)
    throw error
  }
}

/**
 * Retrieves relevant context for a query from the vector store
 */
async function retrieveRelevantContext(query: string, userId: string) {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query)

    // Query Pinecone for relevant chunks
    const response = await queryVectors(embedding, DEFAULT_TOP_K, true, {
      user_id: { $eq: userId },
      record_type: { $eq: "chunk" },
    })

    // Handle potential error from Pinecone
    if ("error" in response && response.error) {
      console.error("Error retrieving context from Pinecone:", response)
      return [] // Return empty array as fallback
    }

    // Format results
    return (response.matches || []).map((match) => ({
      content: match.metadata?.content as string,
      documentName: match.metadata?.document_name as string,
      score: match.score,
    }))
  } catch (error) {
    console.error("Error retrieving context:", error)
    throw error
  }
}
