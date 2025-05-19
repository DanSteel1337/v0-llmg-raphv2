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
 * - @/lib/pinecone-rest-client.ts for vector storage and retrieval
 * - @/lib/embedding-service.ts for embeddings
 * - uuid for ID generation
 */

import { v4 as uuidv4 } from "uuid"
import { upsertVectors, queryVectors, getIndexStats } from "@/lib/pinecone-rest-client"
import { generateEmbedding } from "@/lib/embedding-service"
import { VECTOR_DIMENSION } from "@/lib/embedding-config"
import type { SearchOptions, SearchResult } from "@/types"

// Constants
const DEFAULT_TOP_K = 10
const MAX_KEYWORD_RESULTS = 100

/**
 * Gets search count for a user
 */
export async function getSearchCountByUserId(userId: string): Promise<number> {
  try {
    const stats = await getIndexStats({
      filter: {
        user_id: { $eq: userId },
        record_type: { $eq: "search_history" },
      },
    })

    return stats.namespaces?.[""]?.vectorCount || 0
  } catch (error) {
    console.error("Error getting search count:", error)
    return 0
  }
}

/**
 * Performs a search with the specified type
 */
export async function performSearch(query: string, userId: string, options: SearchOptions): Promise<SearchResult[]> {
  console.log(`Performing ${options.type} search`, { query, userId })

  try {
    // Perform search based on type
    if (options.type === "hybrid") {
      // For hybrid search, combine results from both semantic and keyword search
      const [semanticResults, keywordResults] = await Promise.all([
        semanticSearch(query, userId, options).catch((error) => {
          console.error("Semantic search failed in hybrid search:", error)
          return []
        }),
        keywordSearch(query, userId, options).catch((error) => {
          console.error("Keyword search failed in hybrid search:", error)
          return []
        }),
      ])

      // Combine and deduplicate results
      const combinedResults = [...semanticResults]
      const semanticIds = new Set(semanticResults.map((result) => result.id))

      // Add keyword results that aren't already in semantic results
      for (const result of keywordResults) {
        if (!semanticIds.has(result.id)) {
          combinedResults.push(result)
        }
      }

      // Sort by relevance
      combinedResults.sort((a, b) => b.relevance - a.relevance)

      // Log search query for analytics
      await logSearchQuery(userId, query, "hybrid", options)

      return combinedResults
    } else if (options.type === "semantic") {
      const results = await semanticSearch(query, userId, options)

      // Log search query for analytics
      await logSearchQuery(userId, query, "semantic", options)

      return results
    } else {
      const results = await keywordSearch(query, userId, options)

      // Log search query for analytics
      await logSearchQuery(userId, query, "keyword", options)

      return results
    }
  } catch (error) {
    console.error(`Search error (${options.type}):`, error)
    throw new Error(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`)
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
  try {
    // Create a zero vector with the correct dimension
    const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

    await upsertVectors([
      {
        id: uuidv4(),
        values: zeroVector, // Zero vector with correct dimension
        metadata: {
          user_id: userId,
          query,
          search_type: searchType,
          filters: JSON.stringify(filters),
          record_type: "search_history",
          created_at: new Date().toISOString(),
        },
      },
    ])
    console.log("Search query logged successfully", { userId, query, searchType })
  } catch (error) {
    console.error("Error logging search query:", error)
    // Don't throw, just log the error
  }
}

/**
 * Performs a semantic search using vector embeddings
 */
async function semanticSearch(query: string, userId: string, options: SearchOptions): Promise<SearchResult[]> {
  console.log("Performing semantic search", { query, userId })

  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query)
    console.log("Generated embedding for query", { dimensions: embedding.length })

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
    console.log("Querying Pinecone for semantic search", {
      topK: DEFAULT_TOP_K,
      filter: JSON.stringify(filter).substring(0, 100) + "...",
    })

    const response = await queryVectors(embedding, DEFAULT_TOP_K, true, filter)

    // Handle potential error from Pinecone
    if ("error" in response && response.error) {
      console.error("Error in semantic search Pinecone query:", response)
      return [] // Return empty array as fallback
    }

    console.log("Pinecone query completed", { matchCount: response.matches?.length || 0 })

    // Format results
    return formatSearchResults(response.matches || [])
  } catch (error) {
    console.error("Error performing semantic search:", error)
    throw error
  }
}

/**
 * Performs a keyword search
 */
async function keywordSearch(query: string, userId: string, options: SearchOptions): Promise<SearchResult[]> {
  console.log("Performing keyword search", { query, userId })

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

    // Create a zero vector with the correct dimension
    const zeroVector = new Array(VECTOR_DIMENSION).fill(0)

    // Get all chunks for this user with the applied filters
    console.log("Querying Pinecone for keyword search", {
      maxResults: MAX_KEYWORD_RESULTS,
      filter: JSON.stringify(filter).substring(0, 100) + "...",
    })

    const response = await queryVectors(
      zeroVector, // Zero vector with correct dimension
      MAX_KEYWORD_RESULTS,
      true,
      filter,
    )

    // Handle potential error from Pinecone
    if ("error" in response && response.error) {
      console.error("Error in keyword search Pinecone query:", response)
      return [] // Return empty array as fallback
    }

    console.log("Pinecone query completed", { totalChunks: response.matches?.length || 0 })

    // Filter chunks that contain the query keywords
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 1)
    console.log("Filtering chunks by keywords", { keywords })

    const filteredChunks = (response.matches || []).filter((match) => {
      const content = ((match.metadata?.content as string) || "").toLowerCase()
      return keywords.some((keyword) => content.includes(keyword))
    })
    console.log("Filtered chunks", { matchCount: filteredChunks.length })

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
  return matches.map((match) => {
    // Extract content and ensure it's a string
    const content = (match.metadata?.content as string) || ""

    // Create a title from the first 50 chars of content
    const title = content.substring(0, 50) + (content.length > 50 ? "..." : "")

    return {
      id: match.id,
      title: title,
      content: content,
      documentName: (match.metadata?.document_name as string) || "Unknown Document",
      documentType: (match.metadata?.document_type as string) || "UNKNOWN",
      date: match.metadata?.created_at
        ? new Date(match.metadata.created_at as string).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      relevance: match.score || 0.8, // Use score if available, otherwise default to 0.8
      highlights: generateHighlights(content, match.metadata?.document_name as string),
    }
  })
}

/**
 * Generates highlight snippets from content
 */
function generateHighlights(content: string, documentName?: string): string[] {
  if (!content) return []

  const contentLength = content.length
  const highlights = []

  // First highlight is the beginning of the content
  highlights.push(`${content.substring(0, Math.min(150, contentLength))}${contentLength > 150 ? "..." : ""}`)

  // If content is long enough, add a second highlight from the middle
  if (contentLength > 300) {
    const middleStart = Math.floor(contentLength / 2) - 75
    highlights.push(`...${content.substring(middleStart, middleStart + 150)}...`)
  }

  // Add document name to the highlights if available
  if (documentName) {
    highlights.push(`From document: ${documentName}`)
  }

  return highlights
}
