import { NextResponse } from "next/server"
import { healthCheck } from "@/lib/pinecone-rest-client"
import { getEmbeddingConfig } from "@/lib/embedding-config"

export const runtime = "edge"

export async function GET() {
  try {
    const config = getEmbeddingConfig()

    // Check if environment variables are set
    const envCheck = {
      PINECONE_API_KEY: !!process.env.PINECONE_API_KEY,
      PINECONE_INDEX_NAME: !!process.env.PINECONE_INDEX_NAME,
      PINECONE_HOST: !!process.env.PINECONE_HOST,
    }

    // Check Pinecone connection
    const isHealthy = await healthCheck()

    return NextResponse.json({
      status: isHealthy ? "healthy" : "unhealthy",
      config: {
        model: config.model,
        dimensions: config.dimensions,
        indexName: config.indexName,
        host: config.host.replace(/^(https?:\/\/[^/]+).*$/, "$1"), // Only show the base URL for security
      },
      environment: envCheck,
    })
  } catch (error) {
    console.error("Error checking Pinecone:", error)
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        environment: {
          PINECONE_API_KEY: !!process.env.PINECONE_API_KEY,
          PINECONE_INDEX_NAME: !!process.env.PINECONE_INDEX_NAME,
          PINECONE_HOST: !!process.env.PINECONE_HOST,
        },
      },
      { status: 500 },
    )
  }
}
