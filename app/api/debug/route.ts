/**
 * Debug API Route
 *
 * Tests each component of the document processing pipeline:
 * - File retrieval
 * - Content analysis
 * - Chunking process
 * - Embedding generation
 * - Pinecone connectivity
 *
 * Returns detailed diagnostic information about each step.
 */

import type { NextRequest } from "next/server"
import { chunkDocument } from "@/lib/chunking-utils"
import { generateEmbedding } from "@/lib/embedding-service"
import { healthCheck, queryVectors, createPlaceholderVector } from "@/lib/pinecone-rest-client"
import { VECTOR_DIMENSION, EMBEDDING_MODEL } from "@/lib/embedding-config"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

// Constants for testing
const MAX_CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 150
const TEST_TEXT =
  "This is a test document for debugging purposes. It contains multiple sentences to test the chunking process. Each sentence should be properly processed and embedded. This will help diagnose issues with the document processing pipeline."

interface StepResult {
  success: boolean
  duration: number
  error?: string
  details?: any
}

interface DebugResult {
  timestamp: string
  overall: {
    success: boolean
    duration: number
  }
  steps: {
    fileRetrieval: StepResult
    contentAnalysis: StepResult
    chunking: StepResult
    embedding: StepResult
    pineconeConnectivity: StepResult
  }
  environment: {
    vectorDimension: number
    embeddingModel: string
    runtime: string
  }
}

export async function GET(request: NextRequest) {
  const startTime = performance.now()
  const debugResult: DebugResult = {
    timestamp: new Date().toISOString(),
    overall: {
      success: false,
      duration: 0,
    },
    steps: {
      fileRetrieval: { success: false, duration: 0 },
      contentAnalysis: { success: false, duration: 0 },
      chunking: { success: false, duration: 0 },
      embedding: { success: false, duration: 0 },
      pineconeConnectivity: { success: false, duration: 0 },
    },
    environment: {
      vectorDimension: VECTOR_DIMENSION,
      embeddingModel: EMBEDDING_MODEL,
      runtime: "edge",
    },
  }

  try {
    logger.info("Starting debug API route execution")

    // Step 1: Test file retrieval with a sample URL
    const fileUrl =
      request.nextUrl.searchParams.get("fileUrl") || "https://raw.githubusercontent.com/vercel/next.js/canary/README.md"
    const fileStartTime = performance.now()

    try {
      logger.info(`Testing file retrieval from: ${fileUrl}`)
      const response = await fetch(fileUrl, { cache: "no-store" })

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
      }

      const text = await response.text()
      const fileSize = text.length

      debugResult.steps.fileRetrieval = {
        success: true,
        duration: performance.now() - fileStartTime,
        details: {
          fileUrl,
          fileSize,
          contentPreview: text.substring(0, 200) + "...",
          contentType: response.headers.get("content-type"),
        },
      }

      logger.info(`File retrieval successful: ${fileSize} bytes`)

      // Step 2: Content analysis
      const contentStartTime = performance.now()

      // Use the fetched content or fallback to test text
      const contentToAnalyze = text || TEST_TEXT
      const wordCount = contentToAnalyze.split(/\s+/).length
      const lineCount = contentToAnalyze.split(/\n/).length
      const charCount = contentToAnalyze.length

      debugResult.steps.contentAnalysis = {
        success: true,
        duration: performance.now() - contentStartTime,
        details: {
          wordCount,
          lineCount,
          charCount,
          averageWordLength: charCount / wordCount,
          contentSample: contentToAnalyze.substring(0, 500) + "...",
        },
      }

      logger.info(`Content analysis successful: ${wordCount} words, ${lineCount} lines`)

      // Step 3: Test chunking
      const chunkingStartTime = performance.now()

      const chunks = chunkDocument(contentToAnalyze, MAX_CHUNK_SIZE, CHUNK_OVERLAP)

      debugResult.steps.chunking = {
        success: true,
        duration: performance.now() - chunkingStartTime,
        details: {
          chunkCount: chunks.length,
          averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length,
          firstChunkPreview: chunks[0]?.substring(0, 100) + "...",
          chunkSizes: chunks.map((chunk) => chunk.length),
        },
      }

      logger.info(`Chunking successful: ${chunks.length} chunks created`)

      // Step 4: Test embedding generation
      const embeddingStartTime = performance.now()

      // Only test with the first chunk to save tokens
      const testChunk = chunks[0]?.substring(0, 300) || TEST_TEXT
      const embedding = await generateEmbedding(testChunk)

      debugResult.steps.embedding = {
        success: true,
        duration: performance.now() - embeddingStartTime,
        details: {
          embeddingDimension: embedding.length,
          embeddingModel: EMBEDDING_MODEL,
          embeddingPreview: embedding.slice(0, 5),
          inputTextLength: testChunk.length,
        },
      }

      logger.info(`Embedding generation successful: ${embedding.length} dimensions`)

      // Step 5: Test Pinecone connectivity
      const pineconeStartTime = performance.now()

      const healthCheckResult = await healthCheck()

      if (!healthCheckResult.healthy) {
        throw new Error(`Pinecone health check failed: ${healthCheckResult.error}`)
      }

      // Test a minimal query
      const queryResult = await queryVectors(createPlaceholderVector(), 1, false)

      debugResult.steps.pineconeConnectivity = {
        success: true,
        duration: performance.now() - pineconeStartTime,
        details: {
          healthCheck: healthCheckResult,
          queryTest: {
            success: !queryResult.error,
            matchCount: queryResult.matches?.length || 0,
          },
        },
      }

      logger.info(`Pinecone connectivity test successful`)
    } catch (error) {
      // If file retrieval fails, continue with test text for remaining steps
      logger.error(`File retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      debugResult.steps.fileRetrieval = {
        success: false,
        duration: performance.now() - fileStartTime,
        error: error instanceof Error ? error.message : "Unknown error",
      }

      // Continue with test text for remaining steps
      try {
        // Step 2: Content analysis with test text
        const contentStartTime = performance.now()

        const wordCount = TEST_TEXT.split(/\s+/).length
        const lineCount = TEST_TEXT.split(/\n/).length
        const charCount = TEST_TEXT.length

        debugResult.steps.contentAnalysis = {
          success: true,
          duration: performance.now() - contentStartTime,
          details: {
            wordCount,
            lineCount,
            charCount,
            averageWordLength: charCount / wordCount,
            contentSample: TEST_TEXT,
            note: "Using test text due to file retrieval failure",
          },
        }

        logger.info(`Content analysis successful with test text: ${wordCount} words`)

        // Step 3: Test chunking with test text
        const chunkingStartTime = performance.now()

        const chunks = chunkDocument(TEST_TEXT, MAX_CHUNK_SIZE, CHUNK_OVERLAP)

        debugResult.steps.chunking = {
          success: true,
          duration: performance.now() - chunkingStartTime,
          details: {
            chunkCount: chunks.length,
            averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length,
            firstChunkPreview: chunks[0],
            chunkSizes: chunks.map((chunk) => chunk.length),
            note: "Using test text due to file retrieval failure",
          },
        }

        logger.info(`Chunking successful with test text: ${chunks.length} chunks created`)

        // Step 4: Test embedding generation with test text
        const embeddingStartTime = performance.now()

        const embedding = await generateEmbedding(TEST_TEXT)

        debugResult.steps.embedding = {
          success: true,
          duration: performance.now() - embeddingStartTime,
          details: {
            embeddingDimension: embedding.length,
            embeddingModel: EMBEDDING_MODEL,
            embeddingPreview: embedding.slice(0, 5),
            inputTextLength: TEST_TEXT.length,
            note: "Using test text due to file retrieval failure",
          },
        }

        logger.info(`Embedding generation successful with test text: ${embedding.length} dimensions`)

        // Step 5: Test Pinecone connectivity
        const pineconeStartTime = performance.now()

        const healthCheckResult = await healthCheck()

        if (!healthCheckResult.healthy) {
          throw new Error(`Pinecone health check failed: ${healthCheckResult.error}`)
        }

        // Test a minimal query
        const queryResult = await queryVectors(createPlaceholderVector(), 1, false)

        debugResult.steps.pineconeConnectivity = {
          success: true,
          duration: performance.now() - pineconeStartTime,
          details: {
            healthCheck: healthCheckResult,
            queryTest: {
              success: !queryResult.error,
              matchCount: queryResult.matches?.length || 0,
            },
          },
        }

        logger.info(`Pinecone connectivity test successful`)
      } catch (stepError) {
        // Handle errors in the remaining steps
        logger.error(`Error in debug steps: ${stepError instanceof Error ? stepError.message : "Unknown error"}`)

        // Update the appropriate step with the error
        if (!debugResult.steps.contentAnalysis.success) {
          debugResult.steps.contentAnalysis.error = stepError instanceof Error ? stepError.message : "Unknown error"
        } else if (!debugResult.steps.chunking.success) {
          debugResult.steps.chunking.error = stepError instanceof Error ? stepError.message : "Unknown error"
        } else if (!debugResult.steps.embedding.success) {
          debugResult.steps.embedding.error = stepError instanceof Error ? stepError.message : "Unknown error"
        } else if (!debugResult.steps.pineconeConnectivity.success) {
          debugResult.steps.pineconeConnectivity.error =
            stepError instanceof Error ? stepError.message : "Unknown error"
        }
      }
    }

    // Calculate overall success and duration
    const allStepsSuccessful = Object.values(debugResult.steps).every((step) => step.success)
    debugResult.overall = {
      success: allStepsSuccessful,
      duration: performance.now() - startTime,
    }

    logger.info(`Debug API route completed: success=${allStepsSuccessful}, duration=${debugResult.overall.duration}ms`)

    return new Response(JSON.stringify(debugResult, null, 2), {
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    logger.error(`Unhandled error in debug API route: ${error instanceof Error ? error.message : "Unknown error"}`)

    // Update overall result
    debugResult.overall = {
      success: false,
      duration: performance.now() - startTime,
    }

    return new Response(
      JSON.stringify(
        {
          ...debugResult,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
