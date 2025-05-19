/**
 * Embedding Configuration Check API Route
 *
 * API endpoint for checking the embedding configuration.
 *
 * Dependencies:
 * - @/lib/embedding-config.ts for embedding configuration
 * - @/lib/api-utils for API response handling
 */

import type { NextRequest } from "next/server"
import { EMBEDDING_MODEL, VECTOR_DIMENSION, INDEX_NAME, PINECONE_HOST } from "@/lib/embedding-config"
import { withErrorHandling } from "@/lib/error-handler"
import { healthCheck } from "@/lib/pinecone-rest-client"
import { NextResponse } from "next/server"

export const runtime = "edge"

export const GET = withErrorHandling(async (request: NextRequest) => {
  try {
    // Check Pinecone health
    const pineconeHealth = await healthCheck()

    // Check environment variables
    const envCheck = {
      EMBEDDING_MODEL: process.env.EMBEDDING_MODEL === "text-embedding-3-large",
      PINECONE_API_KEY: !!process.env.PINECONE_API_KEY,
      PINECONE_HOST: !!process.env.PINECONE_HOST,
      PINECONE_INDEX_NAME: !!process.env.PINECONE_INDEX_NAME,
    }

    // Check for potential issues
    const errors = []
    const warnings = []

    // Check model
    if (process.env.EMBEDDING_MODEL !== "text-embedding-3-large") {
      errors.push(`Unsupported model: ${process.env.EMBEDDING_MODEL}. Only text-embedding-3-large is supported.`)
    }

    // Check dimensions
    if (VECTOR_DIMENSION !== 3072) {
      errors.push(`Invalid dimensions: ${VECTOR_DIMENSION}. Expected 3072 for text-embedding-3-large.`)
    }

    // Check index name
    if (!process.env.PINECONE_INDEX_NAME) {
      errors.push("Missing PINECONE_INDEX_NAME environment variable")
    }

    // Check host
    if (!process.env.PINECONE_HOST) {
      errors.push("Missing PINECONE_HOST environment variable")
    } else if (!process.env.PINECONE_HOST.startsWith("https://")) {
      errors.push(`Invalid PINECONE_HOST format: ${process.env.PINECONE_HOST}. Must start with https://`)
    }

    // Check host and index name match
    if (process.env.PINECONE_HOST && process.env.PINECONE_INDEX_NAME) {
      const hostParts = process.env.PINECONE_HOST.split(".")
      if (hostParts.length >= 2) {
        const hostIndexSlug = hostParts[0].split("//")[1]
        if (!hostIndexSlug || !hostIndexSlug.includes(process.env.PINECONE_INDEX_NAME.toLowerCase())) {
          warnings.push(
            `PINECONE_INDEX_NAME (${process.env.PINECONE_INDEX_NAME}) may not match host index slug (${hostIndexSlug})`,
          )
        }
      }
    }

    // If there are errors, return 400 status
    if (errors.length > 0) {
      return NextResponse.json(
        {
          status: "error",
          errors,
          warnings: warnings.length > 0 ? warnings : null,
          config: {
            model: EMBEDDING_MODEL,
            dimensions: VECTOR_DIMENSION,
            indexName: INDEX_NAME,
            host: PINECONE_HOST.split(".")[0], // Only log the first part for security
          },
          pineconeHealth,
          envCheck,
        },
        { status: 400 },
      )
    }

    // Otherwise, return 200 status
    return NextResponse.json({
      status: warnings.length > 0 ? "warning" : "ok",
      warnings: warnings.length > 0 ? warnings : null,
      config: {
        model: EMBEDDING_MODEL,
        dimensions: VECTOR_DIMENSION,
        indexName: INDEX_NAME,
        host: PINECONE_HOST.split(".")[0], // Only log the first part for security
      },
      pineconeHealth,
      envCheck,
    })
  } catch (error) {
    console.error("[EmbeddingConfigAPI] Error checking embedding configuration:", error)
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
})
