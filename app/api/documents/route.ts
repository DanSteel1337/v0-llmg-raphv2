/**
 * Documents API Route
 *
 * Handles document CRUD operations with comprehensive filtering, sorting, and pagination.
 * This route is Edge-compatible and optimized for performance with large document collections.
 *
 * Features:
 * - RESTful API endpoints (GET, POST)
 * - Document listing with filtering, sorting, and pagination
 * - Metadata management for documents
 * - Comprehensive error handling and validation
 * - Analytics for document usage and processing status
 * - Query optimization for large document collections
 *
 * Dependencies:
 * - @/utils/errorHandling for consistent error handling
 * - @/utils/apiRequest for standardized API responses
 * - @/lib/document-service for document operations
 * - @/lib/utils/logger for structured logging
 * - @/lib/pinecone-rest-client for vector operations
 * - @/lib/utils/validators for input validation
 *
 * @module app/api/documents/route
 */

import type { NextRequest } from "next/server"
import { handleApiRequest } from "@/utils/apiRequest"
import { withErrorHandling } from "@/utils/errorHandling"
import { createDocument, getDocumentsByUserId, getDocumentStats, validateDocumentInput } from "@/lib/document-service"
import { logger } from "@/lib/utils/logger"
import { describeIndexStats } from "@/lib/pinecone-rest-client"
import { validatePaginationParams, validateSortParams } from "@/lib/utils/validators"

export const runtime = "edge"

/**
 * Document filter parameters interface
 */
interface DocumentFilterParams {
  userId: string
  status?: string
  type?: string
  startDate?: string
  endDate?: string
  search?: string
  tags?: string[]
}

/**
 * Document sort parameters interface
 */
interface DocumentSortParams {
  field: string
  direction: "asc" | "desc"
}

/**
 * Document pagination parameters interface
 */
interface DocumentPaginationParams {
  limit: number
  offset: number
}

/**
 * Parse and validate filter parameters from search params
 *
 * @param searchParams URL search parameters
 * @returns Validated filter parameters
 */
function parseFilterParams(searchParams: URLSearchParams): DocumentFilterParams {
  const userId = searchParams.get("userId")

  if (!userId) {
    throw new Error("User ID is required")
  }

  // Parse filter parameters
  const status = searchParams.get("status") || undefined
  const type = searchParams.get("type") || undefined
  const startDate = searchParams.get("startDate") || undefined
  const endDate = searchParams.get("endDate") || undefined
  const search = searchParams.get("search") || undefined
  const tagsParam = searchParams.get("tags")
  const tags = tagsParam ? tagsParam.split(",") : undefined

  return {
    userId,
    status,
    type,
    startDate,
    endDate,
    search,
    tags,
  }
}

/**
 * Parse and validate sort parameters from search params
 *
 * @param searchParams URL search parameters
 * @returns Validated sort parameters
 */
function parseSortParams(searchParams: URLSearchParams): DocumentSortParams {
  const sortField = searchParams.get("sortField") || "createdAt"
  const sortDirection = searchParams.get("sortDirection") || "desc"

  // Validate sort parameters
  return validateSortParams(sortField, sortDirection as "asc" | "desc", [
    "name",
    "createdAt",
    "updatedAt",
    "status",
    "fileSize",
    "type",
  ])
}

/**
 * Parse and validate pagination parameters from search params
 *
 * @param searchParams URL search parameters
 * @returns Validated pagination parameters
 */
function parsePaginationParams(searchParams: URLSearchParams): DocumentPaginationParams {
  const limitParam = searchParams.get("limit") || "10"
  const offsetParam = searchParams.get("offset") || "0"

  // Parse and validate pagination parameters
  const limit = Number.parseInt(limitParam, 10)
  const offset = Number.parseInt(offsetParam, 10)

  return validatePaginationParams(limit, offset, 50) // Max 50 items per page
}

/**
 * GET handler for document listing with filtering, sorting, and pagination
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const { searchParams } = new URL(request.url)

    try {
      // Parse and validate request parameters
      const filters = parseFilterParams(searchParams)
      const sort = parseSortParams(searchParams)
      const pagination = parsePaginationParams(searchParams)

      logger.info(`GET /api/documents - Fetching documents for user with filters`, {
        userId: filters.userId,
        filters: JSON.stringify(filters),
        sort: JSON.stringify(sort),
        pagination: JSON.stringify(pagination),
      })

      // Get documents with filters, sorting, and pagination
      const { documents, total } = await getDocumentsByUserId(filters.userId, {
        filters,
        sort,
        pagination,
      })

      // Get document stats for analytics
      const stats = await getDocumentStats(filters.userId)

      // Get vector stats from Pinecone for this user's namespace
      let vectorStats = null
      try {
        const indexStats = await describeIndexStats()
        const userNamespace = `user-${filters.userId}`
        vectorStats = indexStats.namespaces[userNamespace] || { vectorCount: 0 }
      } catch (error) {
        logger.warn(`GET /api/documents - Failed to get vector stats`, {
          userId: filters.userId,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }

      logger.info(`GET /api/documents - Found ${documents.length} documents for user (${total} total)`, {
        userId: filters.userId,
        count: documents.length,
        total,
      })

      return {
        success: true,
        documents,
        pagination: {
          total,
          limit: pagination.limit,
          offset: pagination.offset,
          hasMore: total > pagination.offset + pagination.limit,
        },
        stats,
        vectorStats,
      }
    } catch (error) {
      logger.error(`GET /api/documents - Error parsing request parameters`, {
        error: error instanceof Error ? error.message : "Unknown error",
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : "Invalid request parameters",
      }
    }
  }, request)
})

/**
 * POST handler for document creation with validation
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  return handleApiRequest(async () => {
    const body = await request.json()

    try {
      // Validate required fields
      const { userId, name, description, fileType, fileSize, filePath, tags } = validateDocumentInput(body)

      logger.info(`POST /api/documents - Creating document`, {
        userId,
        name,
        fileType,
        fileSize,
        tags: tags?.join(", "),
      })

      // Create document with metadata
      const document = await createDocument(userId, name, description, fileType, fileSize, filePath, {
        tags,
        createdAt: new Date().toISOString(),
        source: body.source || "upload",
        visibility: body.visibility || "private",
      })

      logger.info(`POST /api/documents - Document created successfully`, {
        documentId: document.id,
        userId,
      })

      return {
        success: true,
        document,
        nextSteps: {
          process: `/api/documents/process?documentId=${document.id}`,
          status: `/api/documents/${document.id}`,
        },
      }
    } catch (error) {
      logger.error(`POST /api/documents - Error creating document`, {
        error: error instanceof Error ? error.message : "Unknown error",
        body: JSON.stringify(body).substring(0, 200), // Log partial body for debugging
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create document",
      }
    }
  }, request)
})
