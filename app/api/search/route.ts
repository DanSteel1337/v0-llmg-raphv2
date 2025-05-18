import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-client"
import { openai } from "@ai-sdk/openai"
import { embed } from "ai"

export async function POST(request: Request) {
  try {
    const { query, type, documentTypes, sortBy, dateRange, userId } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Log the search query
    await supabase.from("search_history").insert({
      user_id: userId,
      query,
      search_type: type || "semantic",
      filters: { documentTypes, sortBy, dateRange },
    })

    // For semantic search, we need to generate an embedding
    if (type === "semantic" || type === "hybrid") {
      try {
        // Generate embedding for the query
        const { embedding } = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: query,
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

        // Format results
        const results = vectorResults.map((result) => ({
          id: result.id,
          title: result.content.substring(0, 50) + "...",
          content: result.content,
          documentName: result.document_name,
          documentType: result.document_name.split(".").pop()?.toUpperCase() || "UNKNOWN",
          date: new Date().toISOString().split("T")[0], // This would come from the document in a real implementation
          relevance: result.similarity,
          highlights: [`...${result.content.substring(0, 150)}...`, `...${result.content.substring(150, 300)}...`],
        }))

        return NextResponse.json({ results })
      } catch (error) {
        console.error("Embedding generation error:", error)
        return NextResponse.json({ error: "Failed to generate embedding" }, { status: 500 })
      }
    } else {
      // Keyword search (simplified implementation)
      const { data: chunks, error: chunksError } = await supabase
        .from("document_chunks")
        .select("id, content, document_id, documents(name)")
        .textSearch("content", query)
        .limit(10)

      if (chunksError) {
        console.error("Keyword search error:", chunksError)
        return NextResponse.json({ error: "Keyword search failed" }, { status: 500 })
      }

      // Format results
      const results = chunks.map((chunk) => ({
        id: chunk.id,
        title: chunk.content.substring(0, 50) + "...",
        content: chunk.content,
        documentName: chunk.documents?.name || "Unknown Document",
        documentType: chunk.documents?.name.split(".").pop()?.toUpperCase() || "UNKNOWN",
        date: new Date().toISOString().split("T")[0], // This would come from the document in a real implementation
        relevance: 0.8, // Placeholder for keyword search
        highlights: [`...${chunk.content.substring(0, 150)}...`, `...${chunk.content.substring(150, 300)}...`],
      }))

      return NextResponse.json({ results })
    }
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
