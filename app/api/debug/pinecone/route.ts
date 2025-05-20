/**
 * Pinecone Debug API Route
 *
 * Tests Pinecone connectivity and operations:
 * - Health check
 * - Vector insertion
 * - Vector query
 * - Vector deletion
 *
 * Returns detailed diagnostic information about Pinecone operations.
 */

import type { NextRequest } from "next/server"
import {
  healthCheck,
  upsertVectors,
  queryVectors,
  deleteVectors,
  createPlaceholderVector,
} from "@/lib/pinecone-rest-client"
import { logger } from "@/lib/utils/logger"

export const runtime = "edge"

export async function GET(request: NextRequest) {
  const startTime = performance.now()
  const debugResult = {
    timestamp: new Date().toISOString(),
    pineconeHost: process.env.PINECONE_HOST || process.env.PINECONE_ENVIRONMENT || "Not configured",
    indexName: process.env.PINECONE_INDEX_NAME || "Not configured",
    steps: {
      healthCheck: { success: false, duration: 0, details: {} },
      vectorInsertion: { success: false, duration: 0, details: {} },
      vectorQuery: { success: false, duration: 0, details: {} },
      vectorDeletion: { success: false, duration: 0, details: {} },
    },
    overall: {
      success: false,
      duration: 0,
    },
  }

  try {
    logger.info("Starting Pinecone debug API route execution")

    // Step 1: Test Pinecone health check
    const healthCheckStartTime = performance.now()

    try {
      logger.info("Testing Pinecone health check")
      const healthCheckResult = await healthCheck()

      debugResult.steps.healthCheck = {
        success: healthCheckResult.healthy,
        duration: performance.now() - healthCheckStartTime,
        details: healthCheckResult,
      }

      if (!healthCheckResult.healthy) {
        throw new Error(`Pinecone health check failed: ${healthCheckResult.error}`)
      }

      logger.info("Pinecone health check successful")
    } catch (error) {
      logger.error(`Pinecone health check failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      debugResult.steps.healthCheck = {
        success: false,
        duration: performance.now() - healthCheckStartTime,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }

      // If health check fails, return early
      debugResult.overall = {
        success: false,
        duration: performance.now() - startTime,
      }

      return new Response(JSON.stringify(debugResult, null, 2), {
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    // Step 2: Test vector insertion
    const insertionStartTime = performance.now()
    const testVectorId = `debug_test_${Date.now()}`

    try {
      logger.info(`Testing Pinecone vector insertion with ID: ${testVectorId}`)
      const vector = createPlaceholderVector()

      const upsertResult = await upsertVectors([
        {
          id: testVectorId,
          values: vector,
          metadata: {
            content: "This is a test vector for debugging purposes",
            created_at: new Date().toISOString(),
            record_type: "debug_test",
          },
        },
      ])

      debugResult.steps.vectorInsertion = {
        success: true,
        duration: performance.now() - insertionStartTime,
        details: {
          vectorId: testVectorId,
          upsertResult,
        },
      }

      logger.info("Pinecone vector insertion successful")
    } catch (error) {
      logger.error(`Pinecone vector insertion failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      debugResult.steps.vectorInsertion = {
        success: false,
        duration: performance.now() - insertionStartTime,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }

    // Step 3: Test vector query
    const queryStartTime = performance.now()

    try {
      logger.info("Testing Pinecone vector query")
      const queryVector = createPlaceholderVector()

      const queryResult = await queryVectors(queryVector, 10, true, {
        record_type: { $eq: "debug_test" },
      })

      debugResult.steps.vectorQuery = {
        success: !queryResult.error,
        duration: performance.now() - queryStartTime,
        details: {
          matchCount: queryResult.matches?.length || 0,
          firstMatch: queryResult.matches?.[0]
            ? {
                id: queryResult.matches[0].id,
                score: queryResult.matches[0].score,
                metadata: queryResult.matches[0].metadata,
              }
            : null,
        },
      }

      logger.info(`Pinecone vector query successful: ${queryResult.matches?.length || 0} matches found`)
    } catch (error) {
      logger.error(`Pinecone vector query failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      debugResult.steps.vectorQuery = {
        success: false,
        duration: performance.now() - queryStartTime,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }

    // Step 4: Test vector deletion
    const deletionStartTime = performance.now()

    try {
      logger.info(`Testing Pinecone vector deletion for ID: ${testVectorId}`)
      const deleteResult = await deleteVectors([testVectorId])

      debugResult.steps.vectorDeletion = {
        success: true,
        duration: performance.now() - deletionStartTime,
        details: {
          vectorId: testVectorId,
          deleteResult,
        },
      }

      logger.info("Pinecone vector deletion successful")
    } catch (error) {
      logger.error(`Pinecone vector deletion failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      debugResult.steps.vectorDeletion = {
        success: false,
        duration: performance.now() - deletionStartTime,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }
    }

    // Calculate overall success and duration
    const allStepsSuccessful = Object.values(debugResult.steps).every((step) => step.success)
    debugResult.overall = {
      success: allStepsSuccessful,
      duration: performance.now() - startTime,
    }

    logger.info(
      `Pinecone debug API route completed: success=${allStepsSuccessful}, duration=${debugResult.overall.duration}ms`,
    )

    return new Response(JSON.stringify(debugResult, null, 2), {
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    logger.error(
      `Unhandled error in Pinecone debug API route: ${error instanceof Error ? error.message : "Unknown error"}`,
    )

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
