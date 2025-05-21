/**
 * Health Check API Route
 *
 * Provides comprehensive health status for all critical services and dependencies
 * of the RAG system. This route is Edge-compatible and works with Vercel's serverless
 * environment.
 *
 * Features:
 * - Checks all critical system components (Pinecone, OpenAI, Supabase, etc.)
 * - Provides detailed health information with error details
 * - Includes response times and latency metrics
 * - Supports partial health checks via query parameters
 * - Implements caching to prevent frequent identical checks
 * - Returns appropriate status codes based on system health
 *
 * @module app/api/health/route
 */

import { type NextRequest, NextResponse } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { logger } from "@/lib/utils/logger"
import { healthCheck as pineconeHealthCheck } from "@/lib/pinecone-rest-client"
import { getEmbeddingCacheStats } from "@/lib/embedding-service"
import { createClient } from "@/lib/supabase-client"

// Define runtime as edge for Vercel Edge Functions
export const runtime = "edge"

// Cache control constants
const CACHE_CONTROL_HEADER = "Cache-Control"
const CACHE_CONTROL_VALUE = "public, max-age=60, stale-while-revalidate=300"
const CACHE_CONTROL_NO_STORE = "no-store, no-cache, must-revalidate, proxy-revalidate"

// Rate limiting (simple in-memory implementation for Edge)
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 10 // 10 requests per minute
const rateLimitCache = new Map<string, { count: number; timestamp: number }>()

// Health check types
interface ComponentHealth {
  healthy: boolean
  latencyMs?: number
  error?: string
  details?: Record<string, any>
}

interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  uptime: number
  components: Record<string, ComponentHealth>
  metrics: {
    totalLatencyMs: number
    componentCount: number
    healthyComponentCount: number
  }
}

// Service start time for uptime calculation
const SERVICE_START_TIME = Date.now()

// In-memory cache for health check results
let healthCheckCache: {
  response: HealthCheckResponse
  timestamp: number
  expiresAt: number
} | null = null

// Cache TTL in milliseconds (30 seconds)
const CACHE_TTL = 30 * 1000

/**
 * Check if the health check cache is valid
 * @returns True if cache is valid, false otherwise
 */
function isHealthCheckCacheValid(): boolean {
  if (!healthCheckCache) return false
  return Date.now() < healthCheckCache.expiresAt
}

/**
 * Apply rate limiting to health check requests
 * @param ip Client IP address
 * @returns True if request is allowed, false if rate limited
 */
function applyRateLimit(ip: string): boolean {
  const now = Date.now()
  const clientKey = `health_${ip}`

  // Clean up old entries
  for (const [key, data] of rateLimitCache.entries()) {
    if (now - data.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitCache.delete(key)
    }
  }

  // Check current client
  const clientData = rateLimitCache.get(clientKey) || { count: 0, timestamp: now }

  // Reset if outside window
  if (now - clientData.timestamp > RATE_LIMIT_WINDOW) {
    clientData.count = 1
    clientData.timestamp = now
  } else {
    clientData.count++
  }

  rateLimitCache.set(clientKey, clientData)

  // Return true if under limit
  return clientData.count <= RATE_LIMIT_MAX
}

/**
 * Check OpenAI API health
 * @returns Health check result for OpenAI API
 */
async function checkOpenAIHealth(): Promise<ComponentHealth> {
  const startTime = Date.now()

  try {
    // Check if API key is configured
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return {
        healthy: false,
        error: "OPENAI_API_KEY is not configured",
      }
    }

    // Simple availability check using a minimal API call
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
    })

    const latencyMs = Date.now() - startTime

    if (!response.ok) {
      return {
        healthy: false,
        latencyMs,
        error: `Status ${response.status}: ${response.statusText}`,
      }
    }

    // Get available models to verify API is working
    const data = await response.json()

    return {
      healthy: true,
      latencyMs,
      details: {
        modelsAvailable: data.data?.length || 0,
        apiVersion: response.headers.get("openai-version") || "unknown",
      },
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    logger.error("OpenAI health check failed", {
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      healthy: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Check Supabase authentication service health
 * @returns Health check result for Supabase
 */
async function checkSupabaseHealth(): Promise<ComponentHealth> {
  const startTime = Date.now()

  try {
    // Check if Supabase is configured
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return {
        healthy: false,
        error: "Supabase configuration is missing",
      }
    }

    // Create a client and check health
    const supabase = createClient()

    // Simple health check - get auth config
    const { data, error } = await supabase.auth.getSession()

    const latencyMs = Date.now() - startTime

    if (error) {
      return {
        healthy: false,
        latencyMs,
        error: error.message,
      }
    }

    return {
      healthy: true,
      latencyMs,
      details: {
        authEnabled: true,
        provider: "supabase",
      },
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    logger.error("Supabase health check failed", {
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      healthy: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Check document processing pipeline health
 * @returns Health check result for document processing
 */
async function checkDocumentProcessingHealth(): Promise<ComponentHealth> {
  const startTime = Date.now()

  try {
    // Check if Blob storage is configured (for document storage)
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN

    if (!blobToken) {
      return {
        healthy: false,
        error: "BLOB_READ_WRITE_TOKEN is not configured",
      }
    }

    // Check embedding service configuration
    const embeddingModel = process.env.EMBEDDING_MODEL

    if (!embeddingModel) {
      return {
        healthy: false,
        error: "EMBEDDING_MODEL is not configured",
      }
    }

    // Get embedding cache stats
    const cacheStats = getEmbeddingCacheStats()

    const latencyMs = Date.now() - startTime

    return {
      healthy: true,
      latencyMs,
      details: {
        embeddingModel,
        embeddingCacheSize: cacheStats.size,
        blobStorageConfigured: true,
      },
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    logger.error("Document processing health check failed", {
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      healthy: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Check internal API routes health
 * @returns Health check result for internal API routes
 */
async function checkInternalAPIHealth(): Promise<ComponentHealth> {
  const startTime = Date.now()

  try {
    // This is a simple self-check since we're already running in an API route
    // In a more complex system, you might want to check other critical API endpoints

    const latencyMs = Date.now() - startTime

    return {
      healthy: true,
      latencyMs,
      details: {
        edgeRuntimeEnabled: true,
      },
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    logger.error("Internal API health check failed", {
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      healthy: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Perform a comprehensive health check of all system components
 * @param components Optional array of component names to check
 * @returns Complete health check response
 */
async function performHealthCheck(components?: string[]): Promise<HealthCheckResponse> {
  logger.info("Performing comprehensive health check", { components })

  const startTime = Date.now()
  const allComponents: Record<string, ComponentHealth> = {}

  // Check if we should check specific components or all
  const checkAll = !components || components.length === 0

  // Check Pinecone
  if (checkAll || components.includes("pinecone")) {
    try {
      const pineconeStartTime = Date.now()
      const pineconeHealth = await pineconeHealthCheck()
      const pineconeLatency = Date.now() - pineconeStartTime

      allComponents.pinecone = {
        healthy: pineconeHealth.healthy,
        latencyMs: pineconeLatency,
        error: pineconeHealth.error,
        details: pineconeHealth.details,
      }
    } catch (error) {
      allComponents.pinecone = {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Check OpenAI
  if (checkAll || components.includes("openai")) {
    allComponents.openai = await checkOpenAIHealth()
  }

  // Check Supabase
  if (checkAll || components.includes("supabase")) {
    allComponents.supabase = await checkSupabaseHealth()
  }

  // Check Document Processing
  if (checkAll || components.includes("document-processing")) {
    allComponents.documentProcessing = await checkDocumentProcessingHealth()
  }

  // Check Internal API
  if (checkAll || components.includes("internal-api")) {
    allComponents.internalApi = await checkInternalAPIHealth()
  }

  // Calculate overall health status
  const componentCount = Object.keys(allComponents).length
  const healthyComponentCount = Object.values(allComponents).filter((c) => c.healthy).length
  const allHealthy = healthyComponentCount === componentCount
  const anyHealthy = healthyComponentCount > 0

  const status = allHealthy ? "healthy" : anyHealthy ? "degraded" : "unhealthy"

  // Calculate total latency
  const totalLatencyMs = Object.values(allComponents).reduce((sum, component) => sum + (component.latencyMs || 0), 0)

  // Build the response
  const response: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - SERVICE_START_TIME) / 1000), // uptime in seconds
    components: allComponents,
    metrics: {
      totalLatencyMs,
      componentCount,
      healthyComponentCount,
    },
  }

  // Cache the response
  healthCheckCache = {
    response,
    timestamp: Date.now(),
    expiresAt: Date.now() + CACHE_TTL,
  }

  logger.info("Health check completed", {
    status,
    duration: Date.now() - startTime,
    healthyComponents: `${healthyComponentCount}/${componentCount}`,
  })

  return response
}

/**
 * GET handler for health check endpoint
 * Returns the health status of all system components
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const url = new URL(request.url)
    const format = url.searchParams.get("format") || "json"
    const components = url.searchParams.get("components")?.split(",") || []
    const noCache = url.searchParams.has("no-cache")
    const simple = url.searchParams.has("simple")

    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

    // Apply rate limiting
    if (!applyRateLimit(ip)) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Try again later.",
        },
        {
          status: 429,
          headers: {
            [CACHE_CONTROL_HEADER]: CACHE_CONTROL_NO_STORE,
            "Retry-After": "60",
          },
        },
      )
    }

    // Check if we can use cached result
    if (!noCache && isHealthCheckCacheValid() && components.length === 0) {
      logger.info("Returning cached health check result", {
        cacheAge: Math.floor((Date.now() - (healthCheckCache?.timestamp || 0)) / 1000),
      })

      const cachedResponse = healthCheckCache!.response

      // For simple format, just return the status
      if (simple) {
        return NextResponse.json(
          { status: cachedResponse.status },
          {
            status: cachedResponse.status === "healthy" ? 200 : cachedResponse.status === "degraded" ? 200 : 503,
            headers: {
              [CACHE_CONTROL_HEADER]: CACHE_CONTROL_VALUE,
            },
          },
        )
      }

      return NextResponse.json(
        { success: true, data: cachedResponse },
        {
          status: cachedResponse.status === "healthy" ? 200 : cachedResponse.status === "degraded" ? 200 : 503,
          headers: {
            [CACHE_CONTROL_HEADER]: CACHE_CONTROL_VALUE,
          },
        },
      )
    }

    // Perform health check
    const healthCheck = await performHealthCheck(components)

    // For simple format, just return the status
    if (simple) {
      return NextResponse.json(
        { status: healthCheck.status },
        {
          status: healthCheck.status === "healthy" ? 200 : healthCheck.status === "degraded" ? 200 : 503,
          headers: {
            [CACHE_CONTROL_HEADER]: noCache ? CACHE_CONTROL_NO_STORE : CACHE_CONTROL_VALUE,
          },
        },
      )
    }

    // Return full health check response
    return NextResponse.json(
      { success: true, data: healthCheck },
      {
        status: healthCheck.status === "healthy" ? 200 : healthCheck.status === "degraded" ? 200 : 503,
        headers: {
          [CACHE_CONTROL_HEADER]: noCache ? CACHE_CONTROL_NO_STORE : CACHE_CONTROL_VALUE,
        },
      },
    )
  }, request)
})

/**
 * HEAD handler for lightweight health check
 * Returns just the status code without body
 */
export const HEAD = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    // Use cached result if available
    if (isHealthCheckCacheValid()) {
      const cachedStatus = healthCheckCache!.response.status

      return new Response(null, {
        status: cachedStatus === "healthy" ? 200 : cachedStatus === "degraded" ? 200 : 503,
        headers: {
          [CACHE_CONTROL_HEADER]: CACHE_CONTROL_VALUE,
        },
      })
    }

    // Perform quick health check of critical components
    const pineconeHealth = await pineconeHealthCheck()
    const openaiHealth = await checkOpenAIHealth()

    const isHealthy = pineconeHealth.healthy && openaiHealth.healthy
    const isDegraded =
      (pineconeHealth.healthy || openaiHealth.healthy) && !(pineconeHealth.healthy && openaiHealth.healthy)

    const status = isHealthy ? "healthy" : isDegraded ? "degraded" : "unhealthy"

    return new Response(null, {
      status: status === "healthy" ? 200 : status === "degraded" ? 200 : 503,
      headers: {
        [CACHE_CONTROL_HEADER]: CACHE_CONTROL_VALUE,
      },
    })
  }, request)
})
