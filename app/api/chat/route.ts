import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-client"
import { openai } from "@ai-sdk/openai"
import { embed, generateText } from "ai"

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

    const supabase = getSupabaseServerClient()

    // Create or get conversation
    let conversation

    if (conversationId) {
      const { data, error } = await supabase.from("chat_conversations").select("*").eq("id", conversationId).single()

      if (error) {
        console.error("Error fetching conversation:", error)
        return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 })
      }

      conversation = data
    } else {
      // Create a new conversation
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: userId,
          title: userMessage.content.substring(0, 50) + "...",
        })
        .select()

      if (error) {
        console.error("Error creating conversation:", error)
        return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
      }

      conversation = data[0]
    }

    // Save user message
    await supabase.from("chat_messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: userMessage.content,
    })

    // Generate embedding for the query
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: userMessage.content,
    })

    // Get vector search settings
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "vector_search")
      .single()

    const vectorSettings = settingsData?.value || {
      match_threshold: 0.78,
      match_count: 5,
    }

    // Perform vector similarity search
    const { data: vectorResults, error: vectorError } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: vectorSettings.match_threshold,
      match_count: vectorSettings.match_count,
    })

    if (vectorError) {
      console.error("Vector search error:", vectorError)
      return NextResponse.json({ error: "Vector search failed" }, { status: 500 })
    }

    // Prepare context from search results
    const context = vectorResults.map((result) => result.content).join("\n\n")

    // Get completion model settings
    const { data: modelSettingsData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "completion_model")
      .single()

    const modelSettings = modelSettingsData?.value || {
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
    const citations = vectorResults.slice(0, 3).map((result, index) => ({
      id: `citation-${index + 1}`,
      text: result.content.substring(0, 100) + "...",
      document: result.document_name,
      page: Math.floor(Math.random() * 50) + 1, // This would be real page numbers in a production system
    }))

    // Save assistant message
    const { data: messageData, error: messageError } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: text,
        citations: citations,
      })
      .select()

    if (messageError) {
      console.error("Error saving assistant message:", messageError)
      return NextResponse.json({ error: "Failed to save assistant message" }, { status: 500 })
    }

    return NextResponse.json({
      id: messageData[0].id,
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
