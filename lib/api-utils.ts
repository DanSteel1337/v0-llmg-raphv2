/**
 * API Utilities
 *
 * Provides standardized API response handling across the serverless RAG system.
 * Includes utilities for response formatting, request parsing, pagination,
 * content negotiation, request validation, and response enhancement.
 *
 * Features:
 * - Standardized response formatting
 * - Safe request parsing with validation
 * - Pagination utilities
 * - Content negotiation helpers
 * - Request validation
 * - Response enhancement with headers
 *
 * Dependencies:
 * - @/lib/error-handler for error handling
 * - @/lib/utils/logger for logging
 *
 * @module lib/api-utils
 */

import { type NextRequest, NextResponse } from "next/server"
import { ValidationError, AuthorizationError, ApiError } from "@/lib/error-handler"
import { logger } from "@/lib/utils/logger"

/**
 * Success response interface
 */
export interface SuccessResponse<T> {
  success: true
  data: T
}

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

/**
 * Pagination metadata interface
 */
export interface PaginationMetadata {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  links?: {
    self?: string
    next?: string
    prev?: string
    first?: string
    last?: string
  }
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  pagination: PaginationMetadata
}

/**
 * Cache control options interface
 */
export interface CacheControlOptions {
  maxAge?: number
  staleWhileRevalidate?: number
  public?: boolean
  private?: boolean
  noCache?: boolean
  noStore?: boolean
  mustRevalidate?: boolean
}

/**
 * Creates a standardized success response
 *
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with formatted success response
 */
export function createSuccessResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    } as SuccessResponse<T>,
    { status },
  )
}

/**
 * Creates a proper streaming response
 *
 * @param stream - ReadableStream to send
 * @param headers - Additional headers to include
 * @returns Response with streaming content
 */
export function createStreamingResponse(stream: ReadableStream, headers?: Record<string, string>): Response {
  const defaultHeaders = {
    "Content-Type": "application/json",
    "Transfer-Encoding": "chunked",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  }

  const responseHeaders = {
    ...defaultHeaders,
    ...headers,
  }

  return new Response(stream, {
    headers: responseHeaders,
  })
}

/**
 * Creates a redirect response
 *
 * @param url - URL to redirect to
 * @param status - HTTP status code (default: 302)
 * @returns NextResponse with redirect
 */
export function createRedirectResponse(url: string, status = 302): NextResponse {
  return NextResponse.redirect(url, status)
}

/**
 * Creates a file download response
 *
 * @param content - File content
 * @param filename - File name
 * @param contentType - Content type (default: application/octet-stream)
 * @returns Response with file content
 */
export function createFileResponse(
  content: string | ArrayBuffer | Uint8Array | ReadableStream,
  filename: string,
  contentType = "application/octet-stream",
): Response {
  return new Response(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}

/**
 * Safely parses JSON request body with validation
 *
 * @param request - NextRequest object
 * @param requiredFields - Optional array of required fields
 * @returns Parsed request body
 * @throws ValidationError if parsing fails or required fields are missing
 */
export async function parseRequestBody<T = any>(request: NextRequest, requiredFields?: string[]): Promise<T> {
  try {
    // Check content type
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
      throw new ValidationError("Content-Type must be application/json", 415)
    }

    // Clone the request to avoid consuming the body
    const clonedRequest = request.clone()

    // Parse the body
    const body = (await clonedRequest.json()) as T

    // Validate required fields if specified
    if (requiredFields && requiredFields.length > 0) {
      const missingFields = requiredFields.filter((field) => !(body as any)[field])
      if (missingFields.length > 0) {
        throw new ValidationError(`Missing required fields: ${missingFields.join(", ")}`, 400)
      }
    }

    return body
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    logger.warn("Failed to parse request body", {
      error: error instanceof Error ? error.message : String(error),
      url: request.url,
    })

    throw new ValidationError(
      "Invalid request body: " + (error instanceof Error ? error.message : "Failed to parse JSON"),
      400,
    )
  }
}

/**
 * Extracts and validates query parameters
 *
 * @param request - NextRequest object
 * @param paramSchema - Optional schema for parameter validation
 * @returns Object with parsed query parameters
 */
export function parseQueryParams<T = Record<string, string | string[]>>(
  request: NextRequest,
  paramSchema?: Record<
    string,
    {
      type?: "string" | "number" | "boolean" | "array"
      required?: boolean
      default?: any
      validator?: (value: any) => boolean
    }
  >,
): T {
  const url = new URL(request.url)
  const params: Record<string, any> = {}

  // Get all query parameters
  for (const [key, value] of url.searchParams.entries()) {
    // Handle array parameters (key[]=value1&key[]=value2)
    if (key.endsWith("[]")) {
      const arrayKey = key.slice(0, -2)
      if (!params[arrayKey]) {
        params[arrayKey] = []
      }
      params[arrayKey].push(value)
    } else {
      // If the parameter already exists, convert to array
      if (params[key] !== undefined) {
        if (!Array.isArray(params[key])) {
          params[key] = [params[key]]
        }
        params[key].push(value)
      } else {
        params[key] = value
      }
    }
  }

  // Apply schema validation if provided
  if (paramSchema) {
    for (const [key, schema] of Object.entries(paramSchema)) {
      // Check required parameters
      if (schema.required && params[key] === undefined) {
        throw new ValidationError(`Missing required query parameter: ${key}`, 400)
      }

      // Apply default value if parameter is missing
      if (params[key] === undefined && schema.default !== undefined) {
        params[key] = schema.default
        continue
      }

      // Skip validation if parameter is not provided
      if (params[key] === undefined) {
        continue
      }

      // Type conversion and validation
      if (schema.type) {
        try {
          switch (schema.type) {
            case "number":
              params[key] = Number(params[key])
              if (isNaN(params[key])) {
                throw new ValidationError(`Query parameter ${key} must be a number`, 400)
              }
              break
            case "boolean":
              if (typeof params[key] === "string") {
                const value = params[key].toLowerCase()
                params[key] = value === "true" || value === "1" || value === "yes"
              }
              break
            case "array":
              if (!Array.isArray(params[key])) {
                params[key] = [params[key]]
              }
              break
          }
        } catch (error) {
          throw new ValidationError(
            `Invalid type for query parameter ${key}: ${error instanceof Error ? error.message : "type conversion failed"}`,
            400,
          )
        }
      }

      // Custom validation
      if (schema.validator && !schema.validator(params[key])) {
        throw new ValidationError(`Invalid value for query parameter ${key}`, 400)
      }
    }
  }

  return params as T
}

/**
 * Gets user ID from headers or query parameters
 *
 * @param request - NextRequest object
 * @param required - Whether user ID is required (default: true)
 * @returns User ID if found
 * @throws AuthorizationError if user ID is required but not found
 */
export function extractUserId(request: NextRequest, required = true): string | null {
  // Try to get from headers first
  const userId = request.headers.get("x-user-id")

  if (userId) {
    return userId
  }

  // Try to get from query parameters
  const url = new URL(request.url)
  const queryUserId = url.searchParams.get("userId")

  if (queryUserId) {
    return queryUserId
  }

  // If required and not found, throw error
  if (required) {
    throw new AuthorizationError("User ID is required", 401)
  }

  return null
}

/**
 * Safely parses multipart form data
 *
 * @param request - NextRequest object
 * @returns FormData object
 * @throws ValidationError if parsing fails
 */
export async function parseFormData(request: NextRequest): Promise<FormData> {
  try {
    // Check content type
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      throw new ValidationError("Content-Type must be multipart/form-data", 415)
    }

    // Clone the request to avoid consuming the body
    const clonedRequest = request.clone()

    // Parse the form data
    return await clonedRequest.formData()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    logger.warn("Failed to parse form data", {
      error: error instanceof Error ? error.message : String(error),
      url: request.url,
    })

    throw new ValidationError(
      "Invalid form data: " + (error instanceof Error ? error.message : "Failed to parse form data"),
      400,
    )
  }
}

/**
 * Extracts pagination parameters from request
 *
 * @param request - NextRequest object
 * @param defaultLimit - Default limit (default: 10)
 * @param maxLimit - Maximum limit (default: 100)
 * @returns Pagination parameters
 */
export function parsePaginationParams(request: NextRequest, defaultLimit = 10, maxLimit = 100): PaginationParams {
  const url = new URL(request.url)

  // Get page and limit parameters
  const pageParam = url.searchParams.get("page")
  const limitParam = url.searchParams.get("limit")

  // Parse and validate page
  let page = pageParam ? Number.parseInt(pageParam, 10) : 1
  if (isNaN(page) || page < 1) {
    page = 1
  }

  // Parse and validate limit
  let limit = limitParam ? Number.parseInt(limitParam, 10) : defaultLimit
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit
  }
  if (limit > maxLimit) {
    limit = maxLimit
  }

  // Calculate offset
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Creates pagination links
 *
 * @param baseUrl - Base URL for links
 * @param page - Current page
 * @param limit - Items per page
 * @param total - Total items
 * @returns Pagination links
 */
export function createPaginationLinks(
  baseUrl: string,
  page: number,
  limit: number,
  total: number,
): PaginationMetadata["links"] {
  const totalPages = Math.ceil(total / limit)
  const url = new URL(baseUrl)

  // Helper to create a link with updated query parameters
  const createLink = (newPage: number): string => {
    const linkUrl = new URL(url.toString())
    linkUrl.searchParams.set("page", newPage.toString())
    linkUrl.searchParams.set("limit", limit.toString())
    return linkUrl.toString()
  }

  const links: PaginationMetadata["links"] = {
    self: createLink(page),
  }

  if (page > 1) {
    links.prev = createLink(page - 1)
    links.first = createLink(1)
  }

  if (page < totalPages) {
    links.next = createLink(page + 1)
    links.last = createLink(totalPages)
  }

  return links
}

/**
 * Adds pagination metadata to response
 *
 * @param data - Response data array
 * @param page - Current page
 * @param limit - Items per page
 * @param total - Total items
 * @param baseUrl - Optional base URL for pagination links
 * @returns Paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  baseUrl?: string,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit)

  const pagination: PaginationMetadata = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }

  if (baseUrl) {
    pagination.links = createPaginationLinks(baseUrl, page, limit, total)
  }

  return {
    success: true,
    data,
    pagination,
  }
}

/**
 * Determines acceptable response format
 *
 * @param request - NextRequest object
 * @param supported - Array of supported content types
 * @returns Best matching content type or default
 */
export function getAcceptedContentType(request: NextRequest, supported: string[] = ["application/json"]): string {
  const acceptHeader = request.headers.get("accept") || "*/*"

  // Parse Accept header
  const acceptedTypes = acceptHeader
    .split(",")
    .map((type) => {
      const [mediaType, qualityStr] = type.trim().split(";q=")
      const quality = qualityStr ? Number.parseFloat(qualityStr) : 1.0
      return { mediaType: mediaType.trim(), quality }
    })
    .filter((type) => type.quality > 0)
    .sort((a, b) => b.quality - a.quality)

  // Find the first supported type
  for (const { mediaType } of acceptedTypes) {
    // Handle wildcards
    if (mediaType === "*/*") {
      return supported[0]
    }

    const [type, subtype] = mediaType.split("/")

    // Handle type wildcards (e.g., "text/*")
    if (subtype === "*") {
      const match = supported.find((supportedType) => supportedType.startsWith(`${type}/`))
      if (match) {
        return match
      }
    }

    // Exact match
    if (supported.includes(mediaType)) {
      return mediaType
    }
  }

  // Default to first supported type
  return supported[0]
}

/**
 * Gets preferred language from headers
 *
 * @param request - NextRequest object
 * @param supported - Array of supported languages
 * @returns Best matching language or default
 */
export function getPreferredLanguage(request: NextRequest, supported: string[] = ["en"]): string {
  const acceptLanguageHeader = request.headers.get("accept-language") || "en"

  // Parse Accept-Language header
  const acceptedLanguages = acceptLanguageHeader
    .split(",")
    .map((lang) => {
      const [language, qualityStr] = lang.trim().split(";q=")
      const quality = qualityStr ? Number.parseFloat(qualityStr) : 1.0
      return { language: language.trim(), quality }
    })
    .filter((lang) => lang.quality > 0)
    .sort((a, b) => b.quality - a.quality)

  // Find the first supported language
  for (const { language } of acceptedLanguages) {
    // Exact match
    if (supported.includes(language)) {
      return language
    }

    // Language match without region (e.g., "en-US" matches "en")
    const baseLanguage = language.split("-")[0]
    if (supported.includes(baseLanguage)) {
      return baseLanguage
    }
  }

  // Default to first supported language
  return supported[0]
}

/**
 * Validates HTTP method
 *
 * @param request - NextRequest object
 * @param allowed - Array of allowed methods
 * @throws ValidationError if method is not allowed
 */
export function validateRequestMethod(request: NextRequest, allowed: string[]): void {
  const method = request.method.toUpperCase()

  if (!allowed.map((m) => m.toUpperCase()).includes(method)) {
    throw new ValidationError(`Method ${method} not allowed. Allowed methods: ${allowed.join(", ")}`, 405)
  }
}

/**
 * Validates Content-Type header
 *
 * @param request - NextRequest object
 * @param allowed - Array of allowed content types
 * @throws ValidationError if content type is not allowed
 */
export function validateContentType(request: NextRequest, allowed: string[]): void {
  const contentType = request.headers.get("content-type") || ""

  // Extract base content type without parameters
  const baseContentType = contentType.split(";")[0].trim().toLowerCase()

  if (!allowed.map((t) => t.toLowerCase()).includes(baseContentType)) {
    throw new ValidationError(`Content-Type ${contentType} not allowed. Allowed types: ${allowed.join(", ")}`, 415)
  }
}

/**
 * Validates Accept header
 *
 * @param request - NextRequest object
 * @param allowed - Array of allowed accept types
 * @throws ValidationError if accept type is not allowed
 */
export function validateAccept(request: NextRequest, allowed: string[]): void {
  const acceptHeader = request.headers.get("accept") || "*/*"

  // If accept header includes wildcard, it's always valid
  if (acceptHeader.includes("*/*")) {
    return
  }

  // Parse Accept header
  const acceptedTypes = acceptHeader.split(",").map((type) => type.trim().split(";")[0].toLowerCase())

  // Check if any accepted type is allowed
  const isValid = acceptedTypes.some((type) => {
    // Handle type wildcards (e.g., "text/*")
    if (type.endsWith("/*")) {
      const prefix = type.split("/*")[0]
      return allowed.some((allowedType) => allowedType.startsWith(`${prefix}/`))
    }

    return allowed.map((t) => t.toLowerCase()).includes(type)
  })

  if (!isValid) {
    throw new ValidationError(`None of the accepted types are supported. Supported types: ${allowed.join(", ")}`, 406)
  }
}

/**
 * Validates request size
 *
 * @param request - NextRequest object
 * @param maxSize - Maximum size in bytes
 * @throws ValidationError if request is too large
 */
export function validateRequestSize(request: NextRequest, maxSize: number): void {
  const contentLength = request.headers.get("content-length")

  if (contentLength && Number.parseInt(contentLength, 10) > maxSize) {
    throw new ValidationError(`Request too large. Maximum size is ${maxSize} bytes`, 413)
  }
}

/**
 * Adds CORS headers to response
 *
 * @param response - Response object
 * @param options - CORS options
 * @returns Response with CORS headers
 */
export function withCorsHeaders(
  response: Response,
  options: {
    allowOrigin?: string | string[]
    allowMethods?: string[]
    allowHeaders?: string[]
    allowCredentials?: boolean
    maxAge?: number
    exposeHeaders?: string[]
  } = {},
): Response {
  const {
    allowOrigin = "*",
    allowMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders = ["Content-Type", "Authorization"],
    allowCredentials = false,
    maxAge = 86400, // 24 hours
    exposeHeaders = [],
  } = options

  const headers = new Headers(response.headers)

  // Allow-Origin
  if (Array.isArray(allowOrigin)) {
    headers.set("Access-Control-Allow-Origin", allowOrigin.join(", "))
  } else {
    headers.set("Access-Control-Allow-Origin", allowOrigin)
  }

  // Allow-Methods
  headers.set("Access-Control-Allow-Methods", allowMethods.join(", "))

  // Allow-Headers
  headers.set("Access-Control-Allow-Headers", allowHeaders.join(", "))

  // Allow-Credentials
  if (allowCredentials) {
    headers.set("Access-Control-Allow-Credentials", "true")
  }

  // Max-Age
  headers.set("Access-Control-Max-Age", maxAge.toString())

  // Expose-Headers
  if (exposeHeaders.length > 0) {
    headers.set("Access-Control-Expose-Headers", exposeHeaders.join(", "))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Adds cache control headers to response
 *
 * @param response - Response object
 * @param options - Cache control options
 * @returns Response with cache control headers
 */
export function withCacheControl(response: Response, options: CacheControlOptions): Response {
  const {
    maxAge,
    staleWhileRevalidate,
    public: isPublic,
    private: isPrivate,
    noCache,
    noStore,
    mustRevalidate,
  } = options

  const headers = new Headers(response.headers)
  const directives: string[] = []

  // Cache visibility
  if (isPublic) {
    directives.push("public")
  } else if (isPrivate) {
    directives.push("private")
  }

  // Cache behavior
  if (noCache) {
    directives.push("no-cache")
  }

  if (noStore) {
    directives.push("no-store")
  }

  if (mustRevalidate) {
    directives.push("must-revalidate")
  }

  // Cache duration
  if (maxAge !== undefined) {
    directives.push(`max-age=${maxAge}`)
  }

  if (staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`)
  }

  // Set the header if we have directives
  if (directives.length > 0) {
    headers.set("Cache-Control", directives.join(", "))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Adds server timing headers to response
 *
 * @param response - Response object
 * @param startTime - Request start time
 * @param metrics - Additional timing metrics
 * @returns Response with server timing headers
 */
export function withResponseTime(
  response: Response,
  startTime: number,
  metrics: Record<string, number> = {},
): Response {
  const headers = new Headers(response.headers)
  const totalTime = Date.now() - startTime

  // Build server timing header
  const timings = [`total;dur=${totalTime}`]

  // Add additional metrics
  for (const [name, duration] of Object.entries(metrics)) {
    timings.push(`${name};dur=${duration}`)
  }

  headers.set("Server-Timing", timings.join(", "))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Handle API request with consistent response format
 * @param handler - Async function that processes the request
 * @param request - The incoming request (optional)
 * @returns Formatted API response
 */
export const handleApiRequest = async (handler: () => Promise<any>, request?: Request): Promise<Response> => {
  try {
    const method = request?.method || "UNKNOWN"
    const url = request ? new URL(request.url) : { pathname: "UNKNOWN" }

    logger.info(`API Request: ${method} ${url.pathname}`)

    const result = await handler()

    // If result is already a Response, return it directly
    if (result instanceof Response) {
      return result
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error("API request error:", {
      error: error instanceof Error ? error.message : String(error),
      path: request ? new URL(request.url).pathname : "UNKNOWN",
    })

    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
    const statusCode = error instanceof ApiError ? error.statusCode : 500

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      {
        status: statusCode,
      },
    )
  }
}

/**
 * Validate required fields in request body
 * @param body - Request body to validate
 * @param fields - Array of required field names
 * @param context - Context for error message (default: "Request")
 * @throws Error if any required fields are missing
 */
export const validateRequiredFields = (body: any, fields: string[], context = "Request"): void => {
  const missingFields = fields.filter((field) => !body[field])
  if (missingFields.length > 0) {
    throw new Error(`${context}: Missing required fields: ${missingFields.join(", ")}`)
  }
}

/**
 * Create a standardized API error response
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 * @returns Formatted error response
 */
export const createErrorResponse = (message: string, status = 400): Response => {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    },
  )
}
