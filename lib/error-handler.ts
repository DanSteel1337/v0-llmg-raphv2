/**
 * Error Handler
 *
 * Provides standardized error handling utilities for the serverless RAG system.
 * Includes custom error classes, error handling middleware, validation utilities,
 * and retry mechanisms.
 *
 * Features:
 * - Custom error classes for different error scenarios
 * - Error handling middleware for API routes
 * - Validation utilities for common inputs
 * - Retry mechanisms with exponential backoff
 * - Standardized error responses
 * - Comprehensive logging
 *
 * Dependencies:
 * - @/lib/utils/logger for logging
 *
 * @module lib/error-handler
 */

import type { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/utils/logger"
import { ErrorCode, type IErrorResponse, type RetryOptions, type ErrorOptions } from "@/types/errors"
import * as validators from "@/lib/utils/validators"
import { ValidationMessages } from "@/constants/validation-messages"

/**
 * Base API Error class
 */
export class ApiError extends Error {
  statusCode: number
  code: string
  context?: Record<string, any>
  timestamp: string

  constructor(message: string, statusCode = 500, code = ErrorCode.INTERNAL, context?: Record<string, any>) {
    super(message)
    this.name = "ApiError"
    this.statusCode = statusCode
    this.code = code
    this.context = context
    this.timestamp = new Date().toISOString()

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }

    // Set the prototype explicitly to ensure instanceof works correctly
    Object.setPrototypeOf(this, this.constructor.prototype)
  }

  /**
   * Converts the error to a user-friendly message
   */
  toUserMessage(): string {
    return this.message
  }

  /**
   * Converts the error to a JSON object
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      stack: process.env.NODE_ENV === "development" ? this.stack : undefined,
    }
  }

  /**
   * Creates a standardized error response
   */
  toErrorResponse(): IErrorResponse {
    return {
      success: false,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.context,
      timestamp: this.timestamp,
    }
  }
}

/**
 * Validation Error class
 */
export class ValidationError extends ApiError {
  fields?: Record<string, string>

  constructor(message: string, fields?: Record<string, string>, options?: ErrorOptions) {
    super(message, options?.statusCode || 400, options?.code || ErrorCode.VALIDATION, options?.context || { fields })
    this.name = "ValidationError"
    this.fields = fields
  }

  /**
   * Converts the error to a user-friendly message including field errors
   */
  toUserMessage(): string {
    if (!this.fields || Object.keys(this.fields).length === 0) {
      return this.message
    }

    const fieldErrors = Object.entries(this.fields)
      .map(([field, error]) => `${field}: ${error}`)
      .join(", ")

    return `${this.message}: ${fieldErrors}`
  }

  /**
   * Converts the error to a JSON object including field errors
   */
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      fields: this.fields,
    }
  }
}

/**
 * Authorization Error class
 */
export class AuthorizationError extends ApiError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options?.statusCode || 403, options?.code || ErrorCode.AUTHORIZATION, options?.context)
    this.name = "AuthorizationError"
  }
}

/**
 * Not Found Error class
 */
export class NotFoundError extends ApiError {
  resource?: string

  constructor(message: string, resource?: string, options?: ErrorOptions) {
    super(message, options?.statusCode || 404, options?.code || ErrorCode.NOT_FOUND, options?.context || { resource })
    this.name = "NotFoundError"
    this.resource = resource
  }
}

/**
 * Rate Limit Error class
 */
export class RateLimitError extends ApiError {
  retryAfter?: number

  constructor(message: string, retryAfter?: number, options?: ErrorOptions) {
    super(
      message,
      options?.statusCode || 429,
      options?.code || ErrorCode.RATE_LIMIT,
      options?.context || { retryAfter },
    )
    this.name = "RateLimitError"
    this.retryAfter = retryAfter
  }
}

/**
 * Service Error class
 */
export class ServiceError extends ApiError {
  retryable: boolean

  constructor(message: string, retryable = false, options?: ErrorOptions) {
    super(message, options?.statusCode || 500, options?.code || ErrorCode.SERVICE, options?.context)
    this.name = "ServiceError"
    this.retryable = retryable
  }
}

/**
 * Processing Error class
 */
export class ProcessingError extends ApiError {
  retryable: boolean
  step?: string

  constructor(message: string, retryable = false, step?: string, options?: ErrorOptions) {
    super(message, options?.statusCode || 500, options?.code || ErrorCode.PROCESSING, options?.context || { step })
    this.name = "ProcessingError"
    this.retryable = retryable
    this.step = step
  }
}

/**
 * Type for API route handlers
 */
export type RouteHandler = (request: NextRequest, params?: any) => Promise<NextResponse | Response>

/**
 * Type for API request handler
 */
export type ApiRequestHandler<T> = (request: NextRequest) => Promise<T>

/**
 * Creates a standardized error response
 *
 * @param error - Error object
 * @param statusCode - HTTP status code
 * @returns Error response object
 */
export function createErrorResponse(error: Error, statusCode = 500): IErrorResponse {
  const timestamp = new Date().toISOString()

  if (error instanceof ApiError) {
    return error.toErrorResponse()
  }

  return {
    success: false,
    error: error.message,
    code: ErrorCode.INTERNAL,
    statusCode,
    timestamp,
  }
}

/**
 * Wraps a route handler with standardized error handling
 *
 * @param handler - Route handler function
 * @returns Wrapped handler function
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, params?: any) => {
    try {
      return await handler(request, params)
    } catch (error) {
      // Get request details for logging
      const url = request.url
      const method = request.method
      const path = new URL(url).pathname
      const timestamp = new Date().toISOString()

      // Determine status code and log level based on error type
      let statusCode = 500
      let logLevel: "error" | "warn" | "info" = "error"
      let errorCode = ErrorCode.INTERNAL

      if (error instanceof ApiError) {
        statusCode = error.statusCode
        errorCode = error.code

        // Adjust log level based on status code
        if (statusCode >= 400 && statusCode < 500) {
          logLevel = "warn"
        }
      }

      // Log the error with appropriate level and context
      const logContext = {
        url,
        method,
        path,
        timestamp,
        statusCode,
        errorCode,
        errorName: error instanceof Error ? error.name : "Unknown",
        stack: error instanceof Error ? error.stack : undefined,
      }

      if (logLevel === "error") {
        logger.error(`API Error: ${error instanceof Error ? error.message : "Unknown error"}`, logContext)
      } else if (logLevel === "warn") {
        logger.warn(`API Warning: ${error instanceof Error ? error.message : "Unknown error"}`, logContext)
      } else {
        logger.info(`API Info: ${error instanceof Error ? error.message : "Unknown error"}`, logContext)
      }

      // Create error response
      const errorResponse = createErrorResponse(error instanceof Error ? error : new Error(String(error)), statusCode)

      // Return JSON response with appropriate status code
      return new Response(JSON.stringify(errorResponse), {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }
  }
}

/**
 * Validates required fields in an object
 *
 * @param obj - Object to validate
 * @param fields - Required field names
 * @throws ValidationError if any required field is missing
 */
export function validateRequiredFields(obj: Record<string, any>, fields: string[]): void {
  const missingFields = fields.filter((field) => obj[field] === undefined || obj[field] === null || obj[field] === "")

  if (missingFields.length > 0) {
    const fieldErrors: Record<string, string> = {}
    missingFields.forEach((field) => {
      fieldErrors[field] = ValidationMessages.required
    })

    throw new ValidationError(`Missing required fields: ${missingFields.join(", ")}`, fieldErrors)
  }
}

/**
 * Validates document ID format
 *
 * @param id - Document ID to validate
 * @throws ValidationError if ID format is invalid
 */
export function validateDocumentId(id: string): void {
  if (!validators.isValidDocumentId(id)) {
    throw new ValidationError(ValidationMessages.documentId, { id: ValidationMessages.documentId })
  }
}

/**
 * Validates user ID format
 *
 * @param id - User ID to validate
 * @throws ValidationError if ID format is invalid
 */
export function validateUserId(id: string): void {
  if (!validators.isValidUserId(id)) {
    throw new ValidationError(ValidationMessages.userId, { id: ValidationMessages.userId })
  }
}

/**
 * Calculates delay for exponential backoff
 *
 * @param attempt - Current attempt number (0-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function exponentialBackoff(attempt: number, baseDelay = 100, maxDelay = 10000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  const jitter = Math.random() * 0.1 * delay // Add up to 10% jitter
  return delay + jitter
}

/**
 * Executes a function with configurable retries and exponential backoff
 *
 * @param fn - Function to execute
 * @param options - Retry options
 * @returns Function result
 * @throws Error if all retries fail
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    retryableErrors = [],
    shouldRetry = (error: Error) => {
      // Default retry logic
      if (error instanceof ServiceError || error instanceof ProcessingError) {
        return error.retryable
      }

      return retryableErrors.some((ErrorClass) => error instanceof ErrorClass)
    },
    onRetry = (error: Error, attempt: number) => {
      logger.warn(`Retry attempt ${attempt}/${maxRetries} after error: ${error.message}`, {
        errorName: error.name,
        attempt,
        maxRetries,
      })
    },
    backoff = exponentialBackoff,
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // If this was the last retry, throw the error
      if (attempt >= maxRetries) {
        throw lastError
      }

      // Check if we should retry
      if (!shouldRetry(lastError)) {
        throw lastError
      }

      // Call onRetry callback
      onRetry(lastError, attempt + 1)

      // Wait before retrying
      const delay = backoff(attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // This should never happen due to the throw in the loop
  throw lastError || new Error("Unknown error in retry mechanism")
}

/**
 * Wraps an API request handler with standardized error handling
 *
 * @param handler - API request handler function
 * @param request - Next.js request object
 * @returns Handler result or error response
 */
export async function handleApiRequest<T>(
  handler: () => Promise<T>,
  request: NextRequest,
): Promise<{ success: true; data: T } | IErrorResponse> {
  try {
    const result = await handler()
    return { success: true, data: result }
  } catch (error) {
    // Get request details for logging
    const url = request.url
    const method = request.method
    const path = new URL(url).pathname
    const timestamp = new Date().toISOString()

    // Determine status code and log level based on error type
    let statusCode = 500
    let logLevel: "error" | "warn" | "info" = "error"
    let errorCode = ErrorCode.INTERNAL

    if (error instanceof ApiError) {
      statusCode = error.statusCode
      errorCode = error.code

      // Adjust log level based on status code
      if (statusCode >= 400 && statusCode < 500) {
        logLevel = "warn"
      }
    }

    // Log the error with appropriate level and context
    const logContext = {
      url,
      method,
      path,
      timestamp,
      statusCode,
      errorCode,
      errorName: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    }

    if (logLevel === "error") {
      logger.error(`API Error: ${error instanceof Error ? error.message : "Unknown error"}`, logContext)
    } else if (logLevel === "warn") {
      logger.warn(`API Warning: ${error instanceof Error ? error.message : "Unknown error"}`, logContext)
    } else {
      logger.info(`API Info: ${error instanceof Error ? error.message : "Unknown error"}`, logContext)
    }

    // Create error response
    return createErrorResponse(error instanceof Error ? error : new Error(String(error)), statusCode)
  }
}
