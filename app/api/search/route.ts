// Info: This file implements search API endpoints using Pinecone for vector search
import { NextResponse } from "next/server"
import { getPineconeIndex } from "@/lib/pinecone-client"
import { openai } from "@ai-sdk/openai"
import { embed } from "ai"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: Request) {
  try {
    const { query, type, documentTypes, sortBy, dateRange, userId } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // Use Pinecone for search and logging
    const pineconeIndex = getPineconeIndex()

    // Log the search query in Pinecone
    await pineconeIndex.upsert([
      {
        id: uuidv4(),
        values: new Array(1536).fill(0), // Placeholder vector
        metadata: {
          user_id: userId,
          query,
          search_type: type || "semantic",
          filters: JSON.stringify({ documentTypes, sortBy, dateRange }),
          record_type: "search_history",
          created_at: new Date().toISOString(),
        },
      },
    ])

    // For semantic search, we need to generate an embedding
    if (type === "semantic" || type === "hybrid") {
      try {
        // Generate embedding for the query
        const { embedding } = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: query,
        })

        // Build filter based on document types if provided
        const filter: any = {
          user_id: { $eq: userId },
          record_type: { $eq: "chunk" },
        }

        if (documentTypes && documentTypes.length > 0) {
          filter.document_type = { $in: documentTypes }
        }

        // Perform vector similarity search in Pinecone
        const queryResponse = await pineconeIndex.query({
          vector: embedding,
          topK: 10,
          includeMetadata: true,
          filter,
        })

        // Format results
        const results = queryResponse.matches.map((match) => ({
          id: match.id,
          title: (match.metadata?.content as string)?.substring(0, 50) + "...",
          content: match.metadata?.content || "",
          documentName: match.metadata?.document_name || "Unknown Document",
          documentType: match.metadata?.document_type || "UNKNOWN",
          date: match.metadata?.created_at
            ? new Date(match.metadata.created_at as string).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          relevance: match.score || 0,
          highlights: [
            `...${(match.metadata?.content as string)?.substring(0, 150)}...`,
            `...${(match.metadata?.content as string)?.substring(150, 300)}...`,
          ],
        }))

        return NextResponse.json({ results })
      } catch (error) {
        console.error("Embedding generation error:", error)
        return NextResponse.json({ error: "Failed to generate embedding" }, { status: 500 })
      }
    } else {
      // Keyword search - more complex in Pinecone without full-text search
      // We'll need to implement a simple keyword matching algorithm

      // Get all chunks for this user
      const queryResponse = await pineconeIndex.query({
        vector: new Array(1536).fill(0), // Placeholder vector
        topK: 100,
        includeMetadata: true,
        filter: {
          user_id: { $eq: userId },
          record_type: { $eq: "chunk" },
        },
      })

      // Filter chunks that contain the query keywords
      const keywords = query.toLowerCase().split(/\s+/)
      const filteredChunks = queryResponse.matches.filter((match) => {
        const content = ((match.metadata?.content as string) || "").toLowerCase()
        return keywords.some((keyword) => content.includes(keyword))
      })

      // Sort by keyword frequency (simple relevance)
      filteredChunks.sort((a, b) => {
        const contentA = ((a.metadata?.content as string) || "").toLowerCase()
        const contentB = ((b.metadata?.content as string) || "").toLowerCase()

        const scoreA = keywords.reduce((count, keyword) => {
          const regex = new RegExp(keyword, "g")
          return count + (contentA.match(regex) || []).length
        }, 0)

        const scoreB = keywords.reduce((count, keyword) => {
          const regex = new RegExp(keyword, "g")
          return count + (contentB.match(regex) || []).length
        }, 0)

        return scoreB - scoreA
      })

      // Format results
      const results = filteredChunks.slice(0, 10).map((match) => ({
        id: match.id,
        title: (match.metadata?.content as string)?.substring(0, 50) + "...",
        content: match.metadata?.content || "",
        documentName: match.metadata?.document_name || "Unknown Document",
        documentType: match.metadata?.document_type || "UNKNOWN",
        date: match.metadata?.created_at
          ? new Date(match.metadata.created_at as string).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        relevance: 0.8, // Placeholder for keyword search
        highlights: [
          `...${(match.metadata?.content as string)?.substring(0, 150)}...`,
          `...${(match.metadata?.content as string)?.substring(150, 300)}...`,
        ],
      }))

      return NextResponse.json({ results })
    }
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
