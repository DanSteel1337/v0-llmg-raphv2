// Info: This file implements conversation API endpoints using Pinecone for storage
import { NextResponse } from "next/server"
import { getPineconeIndex } from "@/lib/pinecone-client"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id

    if (!id) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
    }

    // Use Pinecone for conversation and message storage
    const pineconeIndex = getPineconeIndex()

    // Get the conversation
    const conversationResponse = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Placeholder vector
      topK: 1,
      includeMetadata: true,
      filter: {
        id: { $eq: id },
        record_type: { $eq: "conversation" },
      },
    })

    if (conversationResponse.matches.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const conversation = {
      id: conversationResponse.matches[0].id,
      ...conversationResponse.matches[0].metadata,
    }

    // Get all messages for this conversation
    const messagesResponse = await pineconeIndex.query({
      vector: new Array(1536).fill(0), // Placeholder vector
      topK: 100,
      includeMetadata: true,
      filter: {
        conversation_id: { $eq: id },
        record_type: { $eq: "message" },
      },
    })

    // Format messages
    const messages = messagesResponse.matches.map((match) => {
      const citations = match.metadata?.citations ? JSON.parse(match.metadata.citations as string) : undefined

      return {
        id: match.id,
        role: match.metadata?.role,
        content: match.metadata?.content,
        created_at: match.metadata?.created_at,
        citations,
      }
    })

    // Sort messages by created_at
    messages.sort((a, b) => {
      const dateA = new Date(a.created_at as string).getTime()
      const dateB = new Date(b.created_at as string).getTime()
      return dateA - dateB
    })

    return NextResponse.json({ conversation, messages })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
