/**
 * Chat Service
 *
 * Handles chat operations including:
 * - Message generation
 * - Conversation management
 * - Context retrieval
 *
 * Dependencies:
 * - @/lib/pinecone-client.ts for vector storage
 * - @/lib/embedding-service.ts for embeddings
 * - ai for text generation
 * - @ai-sdk/openai for OpenAI models
 */

import { v4 as uuidv4 } from "uuid"
import { getPineconeIndex } from "@/lib/pinecone-client"
import { generateEmbedding } from "@/lib/embedding-service"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { Message, Conversation, ChatContext } from "@/types"

// Constants
const MAX_CONTEXT_CHUNKS = 5
const MAX_CONVERSATIONS = 50
const MAX_MESSAGES_PER_CONVERSATION = 100

/**
 * Creates a new conversation
 */
export async function createConversation(userId: string, title: string): Promise<Conversation> {
  const pineconeIndex = await getPineconeIndex()
  const conversationId = uuidv4()
  const now = new Date().toISOString()

  const conversation: Conversation = {
    id: conversationId,
    user_id: userId,
    title,
    created_at: now,
    updated_at: now,
    message_count: 0,
  }

  await pineconeIndex.upsert({
    upsertRequest: {
      vectors: [
        {
          id: conversationId,
          values: new Array(1536).fill(0), // Placeholder vector
          metadata: {
            ...conversation,
            record_type: "conversation",
          },
        },
      ],
      namespace: "",
    },
  })

  return conversation
}

/**
 * Gets all conversations for a user
 */
export async function getConversationsByUserId(userId: string): Promise<Conversation[]> {
  const pineconeIndex = await getPineconeIndex()

  const queryResponse = await pineconeIndex.query({
    queryRequest: {
      vector: new Array(1536).fill(0), // Placeholder vector for metadata-only query
      topK: MAX_CONVERSATIONS,
      includeMetadata: true,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "conversation" },
      },
      namespace: "",
    },
  })

  return (queryResponse.matches || []).map((match) => ({
    id: match.id,
    user_id: match.metadata?.user_id || "",
    title: match.metadata?.title || "Untitled",
    created_at: match.metadata?.created_at || new Date().toISOString(),
    updated_at: match.metadata?.updated_at || new Date().toISOString(),
    message_count: match.metadata?.message_count || 0,
  })) as Conversation[]
}

/**
 * Gets a conversation by ID
 */
export async function getConversationById(id: string): Promise<Conversation | null> {
  const pineconeIndex = await getPineconeIndex()

  const queryResponse = await pineconeIndex.query({
    queryRequest: {
      vector: new Array(1536).fill(0), // Placeholder vector for metadata-only query
      topK: 1,
      includeMetadata: true,
      filter: {
        id: { $eq: id },
        record_type: { $eq: "conversation" },
      },
      namespace: "",
    },
  })

  if (!queryResponse.matches || queryResponse.matches.length === 0) {
    return null
  }

  const match = queryResponse.matches[0]

  return {
    id: match.id,
    user_id: match.metadata?.user_id || "",
    title: match.metadata?.title || "Untitled",
    created_at: match.metadata?.created_at || new Date().toISOString(),
    updated_at: match.metadata?.updated_at || new Date().toISOString(),
    message_count: match.metadata?.message_count || 0,
  } as Conversation
}

/**
 * Deletes a conversation and all its messages
 */
export async function deleteConversation(id: string): Promise<void> {
  const pineconeIndex = await getPineconeIndex()

  // Delete the conversation
  await pineconeIndex.delete({
    deleteRequest: {
      ids: [id],
      namespace: "",
    },
  })

  // Find all messages for this conversation
  const queryResponse = await pineconeIndex.query({
    queryRequest: {
      vector: new Array(1536).fill(0), // Placeholder vector for metadata-only query
      topK: MAX_MESSAGES_PER_CONVERSATION,
      includeMetadata: true,
      filter: {
        conversation_id: { $eq: id },
        record_type: { $eq: "message" },
      },
      namespace: "",
    },
  })

  // Delete all messages
  if (queryResponse.matches && queryResponse.matches.length > 0) {
    const messageIds = queryResponse.matches.map((match) => match.id)
    await pineconeIndex.delete({
      deleteRequest: {
        ids: messageIds,
        namespace: "",
      },
    })
  }
}

/**
 * Gets all messages for a conversation
 */
export async function getMessagesByConversationId(conversationId: string): Promise<Message[]> {
  const pineconeIndex = await getPineconeIndex()

  const queryResponse = await pineconeIndex.query({
    queryRequest: {
      vector: new Array(1536).fill(0), // Placeholder vector for metadata-only query
      topK: MAX_MESSAGES_PER_CONVERSATION,
      includeMetadata: true,
      filter: {
        conversation_id: { $eq: conversationId },
        record_type: { $eq: "message" },
      },
      namespace: "",
    },
  })

  const messages = (queryResponse.matches || []).map((match) => ({
    id: match.id,
    conversation_id: match.metadata?.conversation_id || "",
    role: match.metadata?.role || "user",
    content: match.metadata?.content || "",
    created_at: match.metadata?.created_at || new Date().toISOString(),
  })) as Message[]

  // Sort messages by creation time
  return messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

/**
 * Creates a new message in a conversation
 */
export async function createMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Promise<Message> {
  const pineconeIndex = await getPineconeIndex()
  const messageId = uuidv4()
  const now = new Date().toISOString()

  // Generate embedding for the message content
  const embedding = await generateEmbedding(content)

  const message: Message = {
    id: messageId,
    conversation_id: conversationId,
    role,
    content,
    created_at: now,
  }

  await pineconeIndex.upsert({
    upsertRequest: {
      vectors: [
        {
          id: messageId,
          values: embedding,
          metadata: {
            ...message,
            record_type: "message",
          },
        },
      ],
      namespace: "",
    },
  })

  // Update conversation message count and last updated
  const conversation = await getConversationById(conversationId)
  if (conversation) {
    await pineconeIndex.upsert({
      upsertRequest: {
        vectors: [
          {
            id: conversationId,
            values: new Array(1536).fill(0), // Placeholder vector
            metadata: {
              ...conversation,
              message_count: conversation.message_count + 1,
              updated_at: now,
              record_type: "conversation",
            },
          },
        ],
        namespace: "",
      },
    })
  }

  return message
}

/**
 * Generates a response to a user message
 */
export async function generateResponse(userId: string, conversationId: string, userMessage: string): Promise<Message> {
  try {
    // 1. Retrieve relevant context from documents
    const context = await retrieveContext(userId, userMessage)

    // 2. Get conversation history
    const messages = await getMessagesByConversationId(conversationId)

    // 3. Build prompt with context and history
    const prompt = buildPrompt(userMessage, messages, context)

    // 4. Generate response
    const { text } = await generateText({
      model: openai("gpt-4"),
      prompt,
    })

    // 5. Save assistant message
    return await createMessage(conversationId, "assistant", text)
  } catch (error) {
    console.error("Error generating response:", error)
    throw error
  }
}

/**
 * Retrieves relevant context from documents based on the query
 */
async function retrieveContext(userId: string, query: string): Promise<ChatContext[]> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query)

    // Query Pinecone for relevant chunks
    const pineconeIndex = await getPineconeIndex()
    const queryResponse = await pineconeIndex.query({
      queryRequest: {
        vector: embedding,
        topK: MAX_CONTEXT_CHUNKS,
        includeMetadata: true,
        filter: {
          user_id: { $eq: userId },
          record_type: { $eq: "chunk" },
        },
        namespace: "",
      },
    })

    // Format results
    return (queryResponse.matches || []).map((match) => ({
      content: match.metadata?.content || "",
      document_name: match.metadata?.document_name || "",
      section: match.metadata?.section || "",
    }))
  } catch (error) {
    console.error("Error retrieving context:", error)
    return [] // Return empty context on error
  }
}

/**
 * Builds a prompt for the AI model
 */
function buildPrompt(userMessage: string, conversationHistory: Message[], context: ChatContext[]): string {
  // Include relevant context
  let contextText = ""
  if (context.length > 0) {
    contextText = "Here is some relevant information from your documents:\n\n"
    context.forEach((ctx, i) => {
      contextText += `[Document: ${ctx.document_name}${ctx.section ? `, Section: ${ctx.section}` : ""}]\n${ctx.content}\n\n`
    })
  }

  // Include conversation history (last few messages)
  const recentMessages = conversationHistory.slice(-6) // Last 6 messages (3 exchanges)
  let historyText = ""
  if (recentMessages.length > 0) {
    historyText = "Here is our conversation so far:\n\n"
    recentMessages.forEach((msg) => {
      historyText += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n\n`
    })
  }

  // Build the final prompt
  return `You are a helpful AI assistant that answers questions based on the user's documents.
${contextText}
${historyText}
User: ${userMessage}`
}
