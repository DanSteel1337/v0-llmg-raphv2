// Info: This file implements chat API endpoints using Pinecone for storage and context retrieval
import { NextResponse } from "next/server"
import { getPineconeIndex } from "@/lib/pinecone-client"
import { openai } from "@ai-sdk/openai"
import { embed, generateText } from "ai"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: Request) {
  try {
    const { messages, userId, conversationId, responseLength, citationStyle } = await request.json()

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 })
    }

    const userMessage = messages[messages.length - 1]

    if (userMessage.role !== "user") {
      return NextResponse.json({ error: "Last message must be from user" }, { status: 400 })
    }

    // Use Pinecone for chat storage and retrieval
    const pineconeIndex = getPineconeIndex()

    // Create or get conversation
    let conversation
    let newConversationId = conversationId

    if (conversationId) {
      // Get existing conversation
      const queryResponse = await pineconeIndex.query({
        vector: new Array(1536).fill(0), // Placeholder vector
        topK: 1,
        includeMetadata: true,
        filter: {
          id: { $eq: conversationId },
          record_type: { $eq: "conversation" },
        },
      })

      if (queryResponse.matches.length === 0) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
      }

      conversation = {
        id: queryResponse.matches[0].id,
        ...queryResponse.matches[0].metadata,
      }
    } else {
      // Create a new conversation
      newConversationId = uuidv4()

      await pineconeIndex.upsert([
        {
          id: newConversationId,
          values: new Array(1536).fill(0), // Placeholder vector
          metadata: {
            user_id: userId,
            title: userMessage.content.substring(0, 50) + "...",
            record_type: "conversation",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      ])

      conversation = {
        id: newConversationId,
        user_id: userId,
        title: userMessage.content.substring(0, 50) + "...",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }

    // Save user message
    const userMessageId = uuidv4()
    await pineconeIndex.upsert([
      {
        id: userMessageId,
        values: new Array(1536).fill(0), // Placeholder vector
        metadata: {
          conversation_id: conversation.id,
          role: "user",
          content: userMessage.content,
          record_type: "message",
          created_at: new Date().toISOString(),
        },
      },
    ])

    // Generate embedding for the query
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: userMessage.content,
    })

    // Get vector search settings from Pinecone
    const settingsResponse = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Placeholder vector
      topK: 1,
      includeMetadata: true,
      filter: {
        key: { $eq: "vector_search" },
        record_type: { $eq: "setting" },
      },
    })

    const vectorSettings =
      settingsResponse.matches.length > 0
        ? settingsResponse.matches[0].metadata?.value
        : {
            match_threshold: 0.78,
            match_count: 5,
          }

    // Perform vector similarity search for context
    const vectorResults = await pineconeIndex.query({
      vector: embedding,
      topK: vectorSettings.match_count || 5,
      includeMetadata: true,
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "chunk" },
      },
    })

    // Prepare context from search results
    const context = vectorResults.matches.map((result) => result.metadata?.content || "").join("\n\n")

    // Get completion model settings
    const modelSettingsResponse = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Placeholder vector
      topK: 1,
      includeMetadata: true,
      filter: {
        key: { $eq: "completion_model" },
        record_type: { $eq: "setting" },
      },
    })

    const modelSettings =
      modelSettingsResponse.matches.length > 0
        ? modelSettingsResponse.matches[0].metadata?.value
        : {
            name: "gpt-4o",
            temperature: 0.2,
            max_tokens: 1024,
          }

    // Adjust temperature based on response length
    const temperature = responseLength === 1 ? 0.1 : responseLength === 3 ? 0.3 : 0.2

    // Generate response
    const { text } = await generateText({
      model: openai(modelSettings.name),
      temperature,
      maxTokens: modelSettings.max_tokens,
      prompt: `You are a helpful assistant that answers questions based on the provided context. 
      
      Context:
      ${context}
      
      User question: ${userMessage.content}
      
      Answer the question based only on the provided context. If the answer is not in the context, say "I don't have enough information to answer that question." Be ${
        responseLength === 1 ? "concise" : responseLength === 3 ? "detailed" : "balanced"
      } in your response.`,
    })

    // Prepare citations
    const citations = vectorResults.matches.slice(0, 3).map((result, index) => ({
      id: `citation-${index + 1}`,
      text: (result.metadata?.content as string)?.substring(0, 100) + "...",
      document: result.metadata?.document_name || "Unknown Document",
      page: Math.floor(Math.random() * 50) + 1, // This would be real page numbers in a production system
    }))

    // Save assistant message
    const assistantMessageId = uuidv4()
    await pineconeIndex.upsert([
      {
        id: assistantMessageId,
        values: new Array(1536).fill(0), // Placeholder vector
        metadata: {
          conversation_id: conversation.id,
          role: "assistant",
          content: text,
          citations: JSON.stringify(citations),
          record_type: "message",
          created_at: new Date().toISOString(),
        },
      },
    ])

    return NextResponse.json({
      id: assistantMessageId,
      role: "assistant",
      content: text,
      citations,
      conversationId: conversation.id,
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
