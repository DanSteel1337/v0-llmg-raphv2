/**
 * Search Service
 *
 * Handles search functionality including:
 * - Semantic search using vector embeddings
 * - Keyword search for text matching
 * - Hybrid search combining both approaches
 * - Search analytics logging
 *
 * Dependencies:
 * - @/lib/pinecone-client.ts for vector storage and retrieval
 * - @ai-sdk/openai for embeddings
 * - uuid for ID generation
 */

import { openai } from "@ai-sdk/openai"
import { embed } from "ai"
import { v4 as uuidv4 } from "uuid"
import { getPineconeIndex } from "@/lib/pinecone-client"
import type { SearchOptions, SearchResult } from "@/types"

// Constants
const VECTOR_DIMENSION = 1536
const DEFAULT_TOP_K = 10
const MAX_KEYWORD_RESULTS = 100

/**
 * Performs a search with the specified type
 */
export async function performSearch(query: string, userId: string, options: SearchOptions): Promise<SearchResult[]> {
  // Log the search query for analytics
  await logSearchQuery(userId, query, options.type || "semantic", {
    documentTypes: options.documentTypes,
    sortBy: options.sortBy,
    dateRange: options.dateRange,
  })

  // Perform search based on type
  if (options.type === "semantic" || options.type === "hybrid") {
    return semanticSearch(query, userId, options)
  } else {
    return keywordSearch(query, userId, options)
  }
}

/**
 * Logs a search query for analytics
 */
export async function logSearchQuery(
  userId: string,
  query: string,
  searchType: string,
  filters: Record<string, any>,
): Promise<void> {
  const pineconeIndex = await getPineconeIndex()

  await pineconeIndex.upsert({
    upsertRequest: {
      vectors: [
        {
          id: uuidv4(),
          values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
          metadata: {
            user_id: userId,
            query,
            search_type: searchType,
            filters: JSON.stringify(filters),
            record_type: "search_history",
            created_at: new Date().toISOString(),
          },
        },
      ],
      namespace: "",
    },
  })
}

/**
 * Performs a semantic search using vector embeddings
 */
async function semanticSearch(query: string, userId: string, options: SearchOptions): Promise<SearchResult[]> {
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

    if (options.documentTypes && options.documentTypes.length > 0) {
      filter.document_type = { $in: options.documentTypes }
    }

    // Add date range filter if provided
    if (options.dateRange) {
      if (options.dateRange.from) {
        filter.created_at = { ...filter.created_at, $gte: options.dateRange.from.toISOString() }
      }
      if (options.dateRange.to) {
        filter.created_at = { ...filter.created_at, $lte: options.dateRange.to.toISOString() }
      }
    }

    // Perform vector similarity search in Pinecone
    const pineconeIndex = await getPineconeIndex()
    const queryResponse = await pineconeIndex.query({
      queryRequest: {
        vector: embedding,
        topK: DEFAULT_TOP_K,
        includeMetadata: true,
        filter,
        namespace: "",
      },
    })

    // Format results
    return formatSearchResults(queryResponse.matches || [])
  } catch (error) {
    console.error("Error performing semantic search:", error)
    throw error
  }
}

/**
 * Performs a keyword search
 */
async function keywordSearch(query: string, userId: string, options: SearchOptions): Promise<SearchResult[]> {
  try {
    // Build filter based on document types if provided
    const filter: any = {
      user_id: { $eq: userId },
      record_type: { $eq: "chunk" },
    }

    if (options.documentTypes && options.documentTypes.length > 0) {
      filter.document_type = { $in: options.documentTypes }
    }

    // Add date range filter if provided
    if (options.dateRange) {
      if (options.dateRange.from) {
        filter.created_at = { ...filter.created_at, $gte: options.dateRange.from.toISOString() }
      }
      if (options.dateRange.to) {
        filter.created_at = { ...filter.created_at, $lte: options.dateRange.to.toISOString() }
      }
    }

    // Get all chunks for this user with the applied filters
    const pineconeIndex = await getPineconeIndex()
    const queryResponse = await pineconeIndex.query({
      queryRequest: {
        vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
        topK: MAX_KEYWORD_RESULTS,
        includeMetadata: true,
        filter,
        namespace: "",
      },
    })

    // Filter chunks that contain the query keywords
    const keywords = query.toLowerCase().split(/\s+/)
    const filteredChunks = (queryResponse.matches || []).filter((match) => {
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

    // Format results (take top 10)
    return formatSearchResults(filteredChunks.slice(0, DEFAULT_TOP_K))
  } catch (error) {
    console.error("Error performing keyword search:", error)
    throw error
  }
}

/**
 * Formats search results from Pinecone matches
 */
function formatSearchResults(matches: any[]): SearchResult[] {
  return matches.map((match) => ({
    id: match.id,
    title: (match.metadata?.content as string)?.substring(0, 50) + "...",
    content: (match.metadata?.content as string) || "",
    documentName: (match.metadata?.document_name as string) || "Unknown Document",
    documentType: (match.metadata?.document_type as string) || "UNKNOWN",
    date: match.metadata?.created_at
      ? new Date(match.metadata.created_at as string).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    relevance: match.score || 0.8, // Use score if available, otherwise default to 0.8
    highlights: generateHighlights(match.metadata?.content as string),
  }))
}

/**
 * Generates highlight snippets from content
 */
function generateHighlights(content: string): string[] {
  if (!content) return []

  const contentLength = content.length
  const highlights = []

  // First highlight is the beginning of the content
  highlights.push(`...${content.substring(0, Math.min(150, contentLength))}...`)

  // If content is long enough, add a second highlight from the middle
  if (contentLength > 300) {
    const middleStart = Math.floor(contentLength / 2) - 75
    highlights.push(`...${content.substring(middleStart, middleStart + 150)}...`)
  }

  return highlights
}
