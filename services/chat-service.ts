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
 * - @/lib/pinecone-client.ts for vector storage and retrieval
 * - @ai-sdk/openai for LLM integration
 * - uuid for ID generation
 */

import { openai } from "@ai-sdk/openai"
import { embed, streamText } from "ai"
import { v4 as uuidv4 } from "uuid"
import { getPineconeIndex } from "@/lib/pinecone-client"
import type { ChatMessage, Conversation, CreateMessageOptions } from "@/types"

// Constants
const VECTOR_DIMENSION = 1536
const DEFAULT_TOP_K = 5
const MAX_HISTORY_MESSAGES = 10
const SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided context. 
If the answer is not in the context, say that you don't know. 
Always cite your sources using [Document: Title] format at the end of relevant sentences.`

/**
 * Creates a new conversation
 */
export async function createConversation(userId: string, title?: string): Promise<Conversation> {
  const pineconeIndex = getPineconeIndex()
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

  await pineconeIndex.upsert([
    {
      id: conversationId,
      values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
      metadata: {
        ...conversation,
        record_type: "conversation",
      },
    },
  ])

  return conversation
}

/**
 * Gets all conversations for a user
 */
export async function getConversationsByUserId(userId: string): Promise<Conversation[]> {
  const pineconeIndex = getPineconeIndex()

  const queryResponse = await pineconeIndex.query({
    vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector for metadata-only query
    topK: 100,
    includeMetadata: true,
    filter: {
      user_id: { $eq: userId },
      record_type: { $eq: "conversation" },
    },
  })

  return queryResponse.matches.map((match) => ({
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
  const pineconeIndex = getPineconeIndex()

  const queryResponse = await pineconeIndex.query({
    vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector for metadata-only query
    topK: 1,
    includeMetadata: true,
    filter: {
      id: { $eq: id },
      record_type: { $eq: "conversation" },
    },
  })

  if (queryResponse.matches.length === 0) {
    return null
  }

  const match = queryResponse.matches[0]

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
  const pineconeIndex = getPineconeIndex()

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

  await pineconeIndex.upsert([
    {
      id,
      values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
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
  const pineconeIndex = getPineconeIndex()

  // Delete the conversation
  await pineconeIndex.deleteOne(id)

  // Find all messages for this conversation
  const queryResponse = await pineconeIndex.query({
    vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector for metadata-only query
    topK: 1000,
    includeMetadata: true,
    filter: {
      conversation_id: { $eq: id },
      record_type: { $eq: "message" },
    },
  })

  // Delete all messages
  if (queryResponse.matches.length > 0) {
    const messageIds = queryResponse.matches.map((match) => match.id)
    await pineconeIndex.deleteMany(messageIds)
  }
}

/**
 * Gets all messages for a conversation
 */
export async function getMessagesByConversationId(conversationId: string): Promise<ChatMessage[]> {
  const pineconeIndex = getPineconeIndex()

  const queryResponse = await pineconeIndex.query({
    vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector for metadata-only query
    topK: 100,
    includeMetadata: true,
    filter: {
      conversation_id: { $eq: conversationId },
      record_type: { $eq: "message" },
    },
  })

  const messages = queryResponse.matches.map((match) => ({
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
}: CreateMessageOptions): Promise<ChatMessage> {
  const pineconeIndex = getPineconeIndex()
  const messageId = uuidv4()
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
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: content,
  })

  // Store message with embedding
  await pineconeIndex.upsert([
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
    await pineconeIndex.upsert([
      {
        id: conversationId,
        values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
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
  onChunk?: (chunk: string) => void,
): Promise<ChatMessage> {
  try {
    // 1. Retrieve relevant context from vector store
    const context = await retrieveRelevantContext(userMessage, userId)

    // 2. Get conversation history
    const history = await getMessagesByConversationId(conversationId)
    const recentHistory = history.slice(-MAX_HISTORY_MESSAGES).map((msg) => ({ role: msg.role, content: msg.content }))

    // 3. Create system message with context
    const systemMessage = `${SYSTEM_PROMPT}\n\nContext:\n${context.map((item) => `${item.content} [Document: ${item.documentName}]`).join("\n\n")}`

    // 4. Generate response
    let responseContent = ""
    const sources: string[] = []

    // Extract unique document names from context
    context.forEach((item) => {
      if (!sources.includes(item.documentName)) {
        sources.push(item.documentName)
      }
    })

    // Stream the response
    const result = streamText({
      model: openai("gpt-4o"),
      system: systemMessage,
      prompt: userMessage,
      messages: recentHistory,
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta") {
          responseContent += chunk.text
          if (onChunk) {
            onChunk(chunk.text)
          }
        }
      },
    })

    await result.text

    // 5. Save user message
    await createMessage({
      conversationId,
      role: "user",
      content: userMessage,
    })

    // 6. Save assistant response
    const assistantMessage = await createMessage({
      conversationId,
      role: "assistant",
      content: responseContent,
      sources,
    })

    return assistantMessage
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
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: query,
    })

    // Query Pinecone for relevant chunks
    const pineconeIndex = getPineconeIndex()
    const queryResponse = await pineconeIndex.query({
      vector: embedding,
      topK: DEFAULT_TOP_K,
      includeMetadata: true,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "chunk" },
      },
    })

    // Format results
    return queryResponse.matches.map((match) => ({
      content: match.metadata?.content as string,
      documentName: match.metadata?.document_name as string,
      score: match.score,
    }))
  } catch (error) {
    console.error("Error retrieving context:", error)
    throw error
  }
}
