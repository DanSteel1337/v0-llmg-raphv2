/**
 * Configuration API
 *
 * Provides safe access to server-side configuration for client components.
 */

import { NextResponse } from "next/server"
import { getEmbeddingConfig } from "@/lib/embedding-config"

export const runtime = "edge"

export async function GET() {
  try {
    // Get the embedding configuration
    const config = getEmbeddingConfig()

    // Return only safe values (no API keys or sensitive information)
    return NextResponse.json({
      embedding: {
        model: config.model,
        dimensions: config.dimensions,
        // Don't include the full host, just a redacted version
        hostAvailable: !!config.host,
        indexName: config.indexName,
      },
      features: {
        search: true,
        chat: true,
        analytics: true,
        documentUpload: true,
      },
    })
  } catch (error) {
    console.error("[ConfigAPI] Error fetching configuration:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
