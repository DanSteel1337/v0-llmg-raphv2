/**
 * Validators
 *
 * Core validation functions for server-side operations in the serverless RAG system.
 * These functions provide the foundation for all validation throughout the application.
 *
 * @module lib/utils/validators
 */

import { logger } from "@/lib/utils/logger"
import type { Document } from "@/types"

// Constants for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OBJECT_ID_REGEX = /^[0-9a-f]{24}$/i
const JWT_REGEX = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/
const ISO8601_DURATION_REGEX = /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/
const BASE64_REGEX = /^[A-Za-z0-9+/=]+$/
const EMAIL_REGEX =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
const DOCUMENT_ID_PREFIX = "doc_"
const CHUNK_ID_PREFIX = "chunk_"

/**
 * Validates if a string is a valid date string
 *
 * @param dateStr - Date string to validate
 * @param format - Optional format specification (not used in basic implementation)
 * @returns Boolean indicating if the string is a valid date
 */
export function isValidDateString(dateStr: string, format?: string): boolean {
  if (!dateStr || typeof dateStr !== "string") {
    return false
  }

  // If format is specified, we could implement format-specific validation
  // For now, we'll just check if it's a valid date
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

/**
 * Validates if a time range is valid
 *
 * @param startTime - Start time (string or Date)
 * @param endTime - End time (string or Date)
 * @returns Boolean indicating if the time range is valid
 */
export function isValidTimeRange(startTime: string | Date, endTime: string | Date): boolean {
  try {
    const start = startTime instanceof Date ? startTime : new Date(startTime)
    const end = endTime instanceof Date ? endTime : new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false
    }

    return start <= end
  } catch (error) {
    logger.warn("Error validating time range", {
      startTime,
      endTime,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * Validates if a number is a valid Unix timestamp
 *
 * @param timestamp - Unix timestamp to validate
 * @returns Boolean indicating if the timestamp is valid
 */
export function isValidTimestamp(timestamp: number): boolean {
  if (typeof timestamp !== "number" || isNaN(timestamp)) {
    return false
  }

  // Check if timestamp is within reasonable range
  // (from 1970 to 100 years in the future)
  const now = Date.now()
  const hundredYearsInMs = 100 * 365 * 24 * 60 * 60 * 1000
  return timestamp >= 0 && timestamp <= now + hundredYearsInMs
}

/**
 * Validates if a date range is valid
 *
 * @param startDate - Start date (string or Date)
 * @param endDate - End date (string or Date)
 * @returns Boolean indicating if the date range is valid
 */
export function isValidDateRange(startDate: string | Date, endDate: string | Date): boolean {
  try {
    const start = startDate instanceof Date ? startDate : new Date(startDate)
    const end = endDate instanceof Date ? endDate : new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false
    }

    return start <= end
  } catch (error) {
    logger.warn("Error validating date range", {
      startDate,
      endDate,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * Validates if a string is a valid ISO 8601 duration
 *
 * @param duration - Duration string to validate
 * @returns Boolean indicating if the duration is valid
 */
export function isValidDuration(duration: string): boolean {
  if (!duration || typeof duration !== "string") {
    return false
  }

  return ISO8601_DURATION_REGEX.test(duration)
}

/**
 * Validates and normalizes pagination parameters
 *
 * @param params - Pagination parameters
 * @param defaults - Default values
 * @returns Normalized pagination parameters
 */
export function validatePaginationParams(
  params: any,
  defaults: { limit?: number; offset?: number; page?: number; maxLimit?: number } = {},
): { limit: number; offset: number; page: number } {
  const { limit: defaultLimit = 10, offset: defaultOffset = 0, page: defaultPage = 1, maxLimit = 100 } = defaults

  let limit: number
  let offset: number
  let page: number

  // Parse limit
  if (params?.limit !== undefined) {
    limit = Number.parseInt(params.limit, 10)
    if (isNaN(limit) || limit < 1) {
      limit = defaultLimit
    } else if (limit > maxLimit) {
      limit = maxLimit
    }
  } else {
    limit = defaultLimit
  }

  // Parse page
  if (params?.page !== undefined) {
    page = Number.parseInt(params.page, 10)
    if (isNaN(page) || page < 1) {
      page = defaultPage
    }
  } else {
    page = defaultPage
  }

  // Parse offset
  if (params?.offset !== undefined) {
    offset = Number.parseInt(params.offset, 10)
    if (isNaN(offset) || offset < 0) {
      offset = defaultOffset
    }
  } else {
    // Calculate offset from page and limit if not provided
    offset = (page - 1) * limit
  }

  return { limit, offset, page }
}

/**
 * Validates and normalizes sort parameters
 *
 * @param params - Sort parameters
 * @param allowedFields - Allowed fields to sort by
 * @param defaults - Default values
 * @returns Normalized sort parameters
 */
export function validateSortParams(
  params: any,
  allowedFields: string[] = ["created_at", "updated_at", "name"],
  defaults: { field?: string; direction?: "asc" | "desc" } = {},
): { field: string; direction: "asc" | "desc" } {
  const { field: defaultField = "created_at", direction: defaultDirection = "desc" } = defaults

  let field: string
  let direction: "asc" | "desc"

  // Parse sort field
  if (params?.sortBy && typeof params.sortBy === "string" && allowedFields.includes(params.sortBy)) {
    field = params.sortBy
  } else if (params?.field && typeof params.field === "string" && allowedFields.includes(params.field)) {
    field = params.field
  } else {
    field = defaultField
  }

  // Parse sort direction
  if (params?.sortDirection && typeof params.sortDirection === "string") {
    direction = params.sortDirection.toLowerCase() === "asc" ? "asc" : "desc"
  } else if (params?.direction && typeof params.direction === "string") {
    direction = params.direction.toLowerCase() === "asc" ? "asc" : "desc"
  } else {
    direction = defaultDirection
  }

  return { field, direction }
}

/**
 * Validates filter parameters
 *
 * @param params - Filter parameters
 * @param allowedFields - Allowed fields to filter by
 * @returns Validated filter parameters
 */
export function validateFilterParams(params: any, allowedFields: string[] = []): Record<string, any> {
  if (!params || typeof params !== "object") {
    return {}
  }

  const validatedFilters: Record<string, any> = {}

  for (const [key, value] of Object.entries(params)) {
    // Skip if field is not allowed
    if (allowedFields.length > 0 && !allowedFields.includes(key)) {
      continue
    }

    // Skip if value is undefined or null
    if (value === undefined || value === null) {
      continue
    }

    // Handle array values
    if (Array.isArray(value)) {
      validatedFilters[key] = value.filter((item) => item !== undefined && item !== null)
      continue
    }

    // Add valid filter
    validatedFilters[key] = value
  }

  return validatedFilters
}

/**
 * Validates search parameters
 *
 * @param params - Search parameters
 * @returns Validated search parameters
 */
export function validateSearchParams(params: any): {
  query: string
  fields?: string[]
  exact?: boolean
  caseSensitive?: boolean
} {
  const result = {
    query: "",
    fields: undefined as string[] | undefined,
    exact: false,
    caseSensitive: false,
  }

  // Validate query
  if (params?.query && typeof params.query === "string") {
    result.query = params.query.trim()
  } else if (params?.q && typeof params.q === "string") {
    result.query = params.q.trim()
  } else if (params?.search && typeof params.search === "string") {
    result.query = params.search.trim()
  }

  // Validate fields
  if (params?.fields) {
    if (typeof params.fields === "string") {
      result.fields = params.fields.split(",").map((field: string) => field.trim())
    } else if (Array.isArray(params.fields)) {
      result.fields = params.fields
        .filter((field: any) => typeof field === "string")
        .map((field: string) => field.trim())
    }
  }

  // Validate exact match
  if (params?.exact !== undefined) {
    result.exact = Boolean(params.exact)
  }

  // Validate case sensitivity
  if (params?.caseSensitive !== undefined) {
    result.caseSensitive = Boolean(params.caseSensitive)
  }

  return result
}

/**
 * Validates ID parameter format
 *
 * @param id - ID to validate
 * @param prefix - Optional prefix that the ID should have
 * @returns Boolean indicating if the ID is valid
 */
export function isValidIdParam(id: string, prefix?: string): boolean {
  if (!id || typeof id !== "string") {
    return false
  }

  // Check prefix if specified
  if (prefix && !id.startsWith(prefix)) {
    return false
  }

  // Basic validation: non-empty string with reasonable length
  return id.length >= 3 && id.length <= 100
}

/**
 * Validates document ID format
 *
 * @param id - Document ID to validate
 * @returns Boolean indicating if the document ID is valid
 */
export function isValidDocumentId(id: string): boolean {
  return isValidIdParam(id, DOCUMENT_ID_PREFIX) && id.length >= 5
}

/**
 * Validates chunk ID format
 *
 * @param id - Chunk ID to validate
 * @returns Boolean indicating if the chunk ID is valid
 */
export function isValidChunkId(id: string): boolean {
  return isValidIdParam(id, CHUNK_ID_PREFIX) && id.length >= 7
}

/**
 * Validates user ID format
 *
 * @param id - User ID to validate
 * @returns Boolean indicating if the user ID is valid
 */
export function isValidUserId(id: string): boolean {
  return isValidIdParam(id) && id.length >= 3
}

/**
 * Validates content type
 *
 * @param contentType - Content type to validate
 * @param allowedTypes - Allowed content types
 * @returns Boolean indicating if the content type is valid
 */
export function isValidContentType(contentType: string, allowedTypes: string[] = ["application/json"]): boolean {
  if (!contentType || typeof contentType !== "string") {
    return false
  }

  // Extract base content type without parameters
  const baseContentType = contentType.split(";")[0].trim().toLowerCase()

  return allowedTypes.map((type) => type.toLowerCase()).includes(baseContentType)
}

/**
 * Validates request size
 *
 * @param size - Request size in bytes
 * @param maxSize - Maximum allowed size in bytes
 * @returns Boolean indicating if the request size is valid
 */
export function isValidRequestSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean {
  if (typeof size !== "number" || isNaN(size) || size < 0) {
    return false
  }

  return size <= maxSize
}

/**
 * Validates HTTP headers
 *
 * @param headers - Headers object
 * @param requiredHeaders - Required headers
 * @returns Boolean indicating if the headers are valid
 */
export function isValidHeaders(headers: Record<string, string>, requiredHeaders: string[] = []): boolean {
  if (!headers || typeof headers !== "object") {
    return false
  }

  // Check if all required headers are present
  for (const header of requiredHeaders) {
    if (!headers[header] && !headers[header.toLowerCase()]) {
      return false
    }
  }

  return true
}

/**
 * Validates query parameters
 *
 * @param params - Query parameters
 * @param schema - Validation schema
 * @returns Boolean indicating if the parameters are valid
 */
export function isValidQueryParams(
  params: Record<string, any>,
  schema: Record<string, { required?: boolean; type?: string; validator?: (value: any) => boolean }> = {},
): boolean {
  if (!params || typeof params !== "object") {
    return false
  }

  // If no schema is provided, consider all parameters valid
  if (Object.keys(schema).length === 0) {
    return true
  }

  // Check each parameter against schema
  for (const [key, rules] of Object.entries(schema)) {
    // Check if required parameter is present
    if (rules.required && (params[key] === undefined || params[key] === null || params[key] === "")) {
      return false
    }

    // Skip validation if parameter is not provided and not required
    if (params[key] === undefined || params[key] === null || params[key] === "") {
      continue
    }

    // Check type if specified
    if (rules.type) {
      const actualType = Array.isArray(params[key]) ? "array" : typeof params[key]
      if (actualType !== rules.type) {
        return false
      }
    }

    // Check custom validator if specified
    if (rules.validator && !rules.validator(params[key])) {
      return false
    }
  }

  return true
}

/**
 * Validates path parameters
 *
 * @param params - Path parameters
 * @param schema - Validation schema
 * @returns Boolean indicating if the parameters are valid
 */
export function isValidPathParams(
  params: Record<string, any>,
  schema: Record<string, { required?: boolean; type?: string; validator?: (value: any) => boolean }> = {},
): boolean {
  // Path parameters validation is similar to query parameters
  return isValidQueryParams(params, schema)
}

/**
 * Validates if a string is valid JSON
 *
 * @param str - String to validate
 * @returns Boolean indicating if the string is valid JSON
 */
export function isValidJSON(str: string): boolean {
  if (!str || typeof str !== "string") {
    return false
  }

  try {
    JSON.parse(str)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Validates if a string is a valid UUID
 *
 * @param str - String to validate
 * @returns Boolean indicating if the string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  if (!str || typeof str !== "string") {
    return false
  }

  return UUID_REGEX.test(str)
}

/**
 * Validates if a string is valid Base64
 *
 * @param str - String to validate
 * @returns Boolean indicating if the string is valid Base64
 */
export function isValidBase64(str: string): boolean {
  if (!str || typeof str !== "string") {
    return false
  }

  // Check if string length is a multiple of 4
  if (str.length % 4 !== 0) {
    return false
  }

  return BASE64_REGEX.test(str)
}

/**
 * Validates if a string is a valid JWT token
 *
 * @param token - Token to validate
 * @returns Boolean indicating if the token is a valid JWT
 */
export function isValidJWT(token: string): boolean {
  if (!token || typeof token !== "string") {
    return false
  }

  return JWT_REGEX.test(token)
}

/**
 * Validates if a string is a valid MongoDB ObjectId
 *
 * @param id - ID to validate
 * @returns Boolean indicating if the ID is a valid ObjectId
 */
export function isValidObjectId(id: string): boolean {
  if (!id || typeof id !== "string") {
    return false
  }

  return OBJECT_ID_REGEX.test(id)
}

/**
 * Validates if a string is a valid email address
 *
 * @param email - Email to validate
 * @returns Boolean indicating if the email is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false
  }

  return EMAIL_REGEX.test(email)
}

/**
 * Validates if a URL is valid
 *
 * @param url - URL to validate
 * @returns Boolean indicating if the URL is valid
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false
  }

  try {
    const parsedUrl = new URL(url)
    return ["http:", "https:"].includes(parsedUrl.protocol)
  } catch (error) {
    return false
  }
}

/**
 * Validates file name format
 *
 * @param name - File name to validate
 * @returns Boolean indicating if the file name is valid
 */
export function isValidFileName(name: string): boolean {
  if (!name || typeof name !== "string") {
    return false
  }

  // File name should not contain invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/
  return !invalidChars.test(name) && name.length <= 255
}

/**
 * Validates file type
 *
 * @param type - File type to validate
 * @param allowedTypes - Array of allowed file types
 * @returns Boolean indicating if the file type is allowed
 */
export function isValidFileType(type: string, allowedTypes: string[] = ["text/plain"]): boolean {
  if (!type || typeof type !== "string") {
    return false
  }

  return allowedTypes.includes(type)
}

/**
 * Validates file size
 *
 * @param size - File size in bytes
 * @param maxSize - Maximum allowed size in bytes
 * @returns Boolean indicating if the file size is valid
 */
export function isValidFileSize(size: number, maxSize: number = 10 * 1024 * 1024): boolean {
  if (typeof size !== "number" || isNaN(size) || size < 0) {
    return false
  }

  return size <= maxSize
}

/**
 * Validates password complexity
 *
 * @param password - Password to validate
 * @param options - Validation options
 * @returns Boolean indicating if the password meets complexity requirements
 */
export function isValidPassword(
  password: string,
  options: {
    minLength?: number
    requireUppercase?: boolean
    requireLowercase?: boolean
    requireNumbers?: boolean
    requireSpecialChars?: boolean
  } = {},
): boolean {
  if (!password || typeof password !== "string") {
    return false
  }

  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true,
  } = options

  if (password.length < minLength) {
    return false
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    return false
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    return false
  }

  if (requireNumbers && !/\d/.test(password)) {
    return false
  }

  if (requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return false
  }

  return true
}

/**
 * Validates session token format
 *
 * @param token - Session token to validate
 * @returns Boolean indicating if the session token is valid
 */
export function isValidSessionToken(token: string): boolean {
  if (!token || typeof token !== "string") {
    return false
  }

  // Session token should be a JWT or similar format
  return isValidJWT(token)
}

/**
 * Validates API key format
 *
 * @param key - API key to validate
 * @returns Boolean indicating if the API key is valid
 */
export function isValidApiKey(key: string): boolean {
  if (!key || typeof key !== "string") {
    return false
  }

  // API key should be at least 16 characters and contain only allowed characters
  const apiKeyRegex = /^[A-Za-z0-9_-]{16,}$/
  return apiKeyRegex.test(key)
}

/**
 * Normalizes parameters with defaults
 *
 * @param params - Parameters to normalize
 * @param defaults - Default values
 * @returns Normalized parameters
 */
export function normalizeParams(params: Record<string, any>, defaults: Record<string, any> = {}): Record<string, any> {
  if (!params || typeof params !== "object") {
    return { ...defaults }
  }

  const normalized: Record<string, any> = { ...params }

  // Apply defaults for missing properties
  for (const [key, value] of Object.entries(defaults)) {
    if (normalized[key] === undefined || normalized[key] === null) {
      normalized[key] = value
    }
  }

  return normalized
}

/**
 * Sanitizes parameters
 *
 * @param params - Parameters to sanitize
 * @param allowedFields - Allowed fields
 * @returns Sanitized parameters
 */
export function sanitizeParams(params: Record<string, any>, allowedFields: string[] = []): Record<string, any> {
  if (!params || typeof params !== "object") {
    return {}
  }

  const sanitized: Record<string, any> = {}

  // Only include allowed fields
  for (const field of allowedFields) {
    if (params[field] !== undefined) {
      sanitized[field] = params[field]
    }
  }

  return sanitized
}

/**
 * Safely coerces types
 *
 * @param value - Value to coerce
 * @param targetType - Target type
 * @returns Coerced value
 */
export function coerceType(value: any, targetType: string): any {
  if (value === undefined || value === null) {
    return value
  }

  switch (targetType.toLowerCase()) {
    case "string":
      return String(value)
    case "number":
      const num = Number(value)
      return isNaN(num) ? value : num
    case "boolean":
      if (typeof value === "string") {
        const lowercased = value.toLowerCase()
        if (lowercased === "true" || lowercased === "yes" || lowercased === "1") {
          return true
        }
        if (lowercased === "false" || lowercased === "no" || lowercased === "0") {
          return false
        }
      }
      return Boolean(value)
    case "date":
      if (value instanceof Date) {
        return value
      }
      const date = new Date(value)
      return isNaN(date.getTime()) ? value : date
    case "array":
      if (Array.isArray(value)) {
        return value
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value)
          return Array.isArray(parsed) ? parsed : [value]
        } catch (error) {
          return [value]
        }
      }
      return [value]
    case "object":
      if (typeof value === "object" && !Array.isArray(value)) {
        return value
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value)
          return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { value }
        } catch (error) {
          return { value }
        }
      }
      return { value }
    default:
      return value
  }
}

/**
 * Extracts only valid fields from an object
 *
 * @param obj - Object to extract fields from
 * @param allowedFields - Allowed fields
 * @returns Object with only allowed fields
 */
export function extractValidFields(obj: Record<string, any>, allowedFields: string[]): Record<string, any> {
  if (!obj || typeof obj !== "object") {
    return {}
  }

  const result: Record<string, any> = {}

  for (const field of allowedFields) {
    if (obj[field] !== undefined) {
      result[field] = obj[field]
    }
  }

  return result
}

/**
 * Validates if an object is a valid Document
 *
 * @param doc Any object to validate
 * @returns Type guard for Document
 */
export function isValidDocument(doc: any): doc is Document {
  return (
    !!doc?.id &&
    typeof doc.id === "string" &&
    isValidDocumentId(doc.id) &&
    typeof doc.file_path === "string" &&
    doc.file_path.length > 0
  )
}
