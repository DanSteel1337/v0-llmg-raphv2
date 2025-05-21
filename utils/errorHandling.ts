/**
 * Error Handling Utilities
 *
 * Provides standardized error handling functions and classes for the client-side
 * of the serverless RAG system. These utilities are designed to work in browser
 * environments and provide consistent error handling across the application.
 *
 * @module utils/errorHandling
 * @client This module is designed for client-side use only
 */

import { toast } from "@/components/ui/toast"
import { logger } from "@/utils/client-logger" // Updated to use client-safe logger
import {
  ErrorCode,
  type IAppError,
  type IValidationError,
  type IAuthError,
  type IAuthorizationError,
  type INotFoundError,
  type IRateLimitError,
  type IServiceError,
  type INetworkError,
  type ITimeoutError,
  type ErrorOptions,
  type ErrorHandler,
  type IErrorResponse,
} from "@/types/errors"
import { ValidationMessages } from "@/constants/validation-messages"

/**
 * Base error class for application errors
 *
 * @client Safe for client-side use
 */
export class AppError extends Error implements IAppError {
  code: string
  statusCode: number
  context?: Record<string, any>
  retryable: boolean
  timestamp: string

  /**
   * Creates a new AppError instance
   *
   * @param message - Error message
   * @param code - Error code
   * @param options - Additional error options
   */
  constructor(message: string, code = ErrorCode.INTERNAL, options: ErrorOptions = {}) {
    super(message)
    this.name = this.constructor.name
    this.code = options.code || code
    this.statusCode = options.statusCode || 500
    this.context = options.context
    this.retryable = options.retryable ?? false
    this.timestamp = new Date().toISOString()

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }

    // Set the prototype explicitly to ensure instanceof works correctly
    Object.setPrototypeOf(this, this.constructor.prototype)
  }

  /**
   * Creates a user-friendly error message
   *
   * @returns User-friendly error message
   */
  toUserMessage(): string {
    return this.message
  }

  /**
   * Creates a detailed error object for logging
   *
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      retryable: this.retryable,
      timestamp: this.timestamp,
      stack: process.env.NODE_ENV === "development" ? this.stack : undefined,
    }
  }
}

/**
 * Error class for validation errors
 *
 * @client Safe for client-side use
 */
export class ValidationError extends AppError implements IValidationError {
  fields?: Record<string, string>

  /**
   * Creates a new ValidationError instance
   *
   * @param message - Error message
   * @param fields - Field-specific error messages
   * @param options - Additional error options
   */
  constructor(message: string, fields?: Record<string, string>, options: ErrorOptions = {}) {
    super(message, ErrorCode.VALIDATION, {
      ...options,
      statusCode: options.statusCode || 400,
    })
    this.fields = fields
  }

  /**
   * Creates a user-friendly error message including field errors
   *
   * @returns User-friendly error message
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
   * Creates a detailed error object for logging including field errors
   *
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      fields: this.fields,
    }
  }
}

/**
 * Error class for authentication errors
 *
 * @client Safe for client-side use
 */
export class AuthError extends AppError implements IAuthError {
  /**
   * Creates a new AuthError instance
   *
   * @param message - Error message
   * @param options - Additional error options
   */
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, ErrorCode.AUTHENTICATION, {
      ...options,
      statusCode: options.statusCode || 401,
    })
  }
}

/**
 * Error class for authorization errors
 *
 * @client Safe for client-side use
 */
export class AuthorizationError extends AppError implements IAuthorizationError {
  /**
   * Creates a new AuthorizationError instance
   *
   * @param message - Error message
   * @param options - Additional error options
   */
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, ErrorCode.AUTHORIZATION, {
      ...options,
      statusCode: options.statusCode || 403,
    })
  }
}

/**
 * Error class for resource not found errors
 *
 * @client Safe for client-side use
 */
export class NotFoundError extends AppError implements INotFoundError {
  resource?: string

  /**
   * Creates a new NotFoundError instance
   *
   * @param message - Error message
   * @param resource - Resource that was not found
   * @param options - Additional error options
   */
  constructor(message: string, resource?: string, options: ErrorOptions = {}) {
    super(message, ErrorCode.NOT_FOUND, {
      ...options,
      statusCode: options.statusCode || 404,
    })
    this.resource = resource
  }
}

/**
 * Error class for rate limiting errors
 *
 * @client Safe for client-side use
 */
export class RateLimitError extends AppError implements IRateLimitError {
  retryAfter?: number

  /**
   * Creates a new RateLimitError instance
   *
   * @param message - Error message
   * @param retryAfter - Time in seconds after which to retry
   * @param options - Additional error options
   */
  constructor(message: string, retryAfter?: number, options: ErrorOptions = {}) {
    super(message, ErrorCode.RATE_LIMIT, {
      ...options,
      statusCode: options.statusCode || 429,
      retryable: options.retryable ?? true,
    })
    this.retryAfter = retryAfter
  }
}

/**
 * Error class for server-side errors
 *
 * @client Safe for client-side use
 */
export class ServerError extends AppError implements IServiceError {
  /**
   * Creates a new ServerError instance
   *
   * @param message - Error message
   * @param options - Additional error options
   */
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, ErrorCode.SERVICE, {
      ...options,
      statusCode: options.statusCode || 500,
      retryable: options.retryable ?? true,
    })
  }
}

/**
 * Error class for network errors
 *
 * @client Safe for client-side use
 */
export class NetworkError extends AppError implements INetworkError {
  /**
   * Creates a new NetworkError instance
   *
   * @param message - Error message
   * @param options - Additional error options
   */
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, ErrorCode.NETWORK, {
      ...options,
      retryable: options.retryable ?? true,
    })
  }
}

/**
 * Error class for timeout errors
 *
 * @client Safe for client-side use
 */
export class TimeoutError extends AppError implements ITimeoutError {
  /**
   * Creates a new TimeoutError instance
   *
   * @param message - Error message
   * @param options - Additional error options
   */
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, ErrorCode.TIMEOUT, {
      ...options,
      retryable: options.retryable ?? true,
    })
  }
}

/**
 * Higher-order function to wrap functions with standardized error handling
 *
 * @param handler - Function to wrap with error handling
 * @param options - Error handling options
 * @returns Wrapped function with error handling
 *
 * @example
 * ```typescript
 * const safeFunction = withErrorHandling(
 *   async () => await fetchData(),
 *   {
 *     showToast: true,
 *     rethrow: false,
 *     context: { component: 'DataFetcher' }
 *   }
 * );
 * ```
 *
 * @client Safe for client-side use
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
  handler: T,
  options: {
    onError?: ErrorHandler
    showToast?: boolean
    rethrow?: boolean
    transformError?: (error: any) => Error
    context?: Record<string, any>
  } = {},
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const {
    onError,
    showToast = true,
    rethrow = false,
    transformError = (e) => handleApiError(e),
    context = {},
  } = options

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      // Handle both synchronous and asynchronous functions
      const result = handler(...args)
      if (result instanceof Promise) {
        return await result
      }
      return result
    } catch (error) {
      // Transform the error to a standardized format
      const transformedError = transformError(error)

      // Log the error
      logError(transformedError, {
        function: handler.name,
        arguments: args.map((arg) => (typeof arg === "object" ? "(object)" : String(arg))).join(", "),
        ...context,
      })

      // Show toast notification if enabled
      if (showToast && typeof window !== "undefined") {
        showErrorToast(transformedError)
      }

      // Call custom error handler if provided
      if (onError) {
        onError(transformedError)
      }

      // Rethrow the error if specified
      if (rethrow) {
        throw transformedError
      }

      // Return a default value or undefined
      return undefined as unknown as ReturnType<T>
    }
  }
}

/**
 * Transforms API errors into standardized application errors
 *
 * @param error - Error to transform
 * @returns Standardized error
 *
 * @example
 * ```typescript
 * try {
 *   await fetchData();
 * } catch (error) {
 *   const appError = handleApiError(error);
 *   // Now you can use appError.toUserMessage() or appError.toJSON()
 * }
 * ```
 *
 * @client Safe for client-side use
 */
export function handleApiError(error: any): Error {
  // If it's already one of our application errors, return it
  if (error instanceof AppError) {
    return error
  }

  // Handle API error responses
  if (error && typeof error === "object" && "success" in error && error.success === false) {
    const apiError = error as IErrorResponse

    switch (apiError.code) {
      case ErrorCode.VALIDATION:
        return new ValidationError(apiError.error, apiError.details?.fields)
      case ErrorCode.AUTHENTICATION:
        return new AuthError(apiError.error)
      case ErrorCode.AUTHORIZATION:
        return new AuthorizationError(apiError.error)
      case ErrorCode.NOT_FOUND:
        return new NotFoundError(apiError.error, apiError.details?.resource)
      case ErrorCode.RATE_LIMIT:
        return new RateLimitError(apiError.error, apiError.details?.retryAfter)
      case ErrorCode.SERVICE:
      case ErrorCode.PROCESSING:
        return new ServerError(apiError.error, {
          statusCode: apiError.statusCode,
          context: apiError.details,
        })
      default:
        return new AppError(apiError.error, apiError.code, {
          statusCode: apiError.statusCode,
          context: apiError.details,
        })
    }
  }

  // Handle fetch Response objects
  if (error instanceof Response || (error && "status" in error && "statusText" in error)) {
    const status = error.status
    const message = error.statusText || `API error: ${status}`

    if (status === 400) {
      return new ValidationError(message)
    } else if (status === 401) {
      return new AuthError(message)
    } else if (status === 403) {
      return new AuthorizationError(message)
    } else if (status === 404) {
      return new NotFoundError(message)
    } else if (status === 429) {
      return new RateLimitError(message)
    } else if (status >= 500) {
      return new ServerError(message)
    }

    return new AppError(message, ErrorCode.INTERNAL, { statusCode: status })
  }

  // Handle network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new NetworkError("Network error: Unable to connect to the server", { cause: error })
  }

  // Handle timeout errors
  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return new TimeoutError("Request timed out", { cause: error })
  }

  // Handle client-side API errors
  if (error && typeof error === "object" && "isNetworkError" in error) {
    if (error.isNetworkError) {
      return new NetworkError(error.message || "Network error", { cause: error })
    }
    if (error.isTimeoutError) {
      return new TimeoutError(error.message || "Request timed out", { cause: error })
    }
    if (error.isServerError) {
      return new ServerError(error.message || "Server error", {
        statusCode: error.statusCode,
        cause: error,
      })
    }

    return new AppError(error.message || "API error", ErrorCode.INTERNAL, {
      statusCode: error.statusCode,
      cause: error,
    })
  }

  // For standard errors, preserve the original error
  if (error instanceof Error) {
    return error
  }

  // For unknown error types, create a generic error
  return new AppError(typeof error === "string" ? error : "An unknown error occurred", ErrorCode.INTERNAL, {
    cause: error instanceof Error ? error : undefined,
  })
}

/**
 * Extracts a user-friendly error message from any error object
 *
 * @param error - Error to parse
 * @returns User-friendly error message
 *
 * @client Safe for client-side use
 */
export function parseErrorMessage(error: any): string {
  if (!error) {
    return "An unknown error occurred"
  }

  // Use toUserMessage for our custom errors
  if (error instanceof AppError) {
    return error.toUserMessage()
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message
  }

  // Handle string errors
  if (typeof error === "string") {
    return error
  }

  // Handle objects with message property
  if (typeof error === "object" && "message" in error) {
    return String(error.message)
  }

  // Handle objects with error property
  if (typeof error === "object" && "error" in error) {
    if (typeof error.error === "string") {
      return error.error
    }
    if (typeof error.error === "object" && error.error && "message" in error.error) {
      return String(error.error.message)
    }
  }

  // Fallback for unknown error formats
  try {
    return JSON.stringify(error)
  } catch {
    return "An unknown error occurred"
  }
}

/**
 * Logs an error with additional context
 *
 * @param error - Error to log
 * @param context - Additional context information
 *
 * @client Safe for client-side use
 */
export function logError(error: any, context: Record<string, any> = {}): void {
  const timestamp = new Date().toISOString()

  // Create a structured error object for logging
  const errorInfo = {
    timestamp,
    ...context,
    error:
      error instanceof AppError
        ? error.toJSON()
        : {
            message: parseErrorMessage(error),
            stack: error instanceof Error ? error.stack : undefined,
            originalError: error,
          },
  }

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error("Application error:", errorInfo)
  }

  // Log using the client logger utility
  logger.error(`Error: ${parseErrorMessage(error)}`, errorInfo)
}

/**
 * Checks if an error is a network error
 *
 * @param error - Error to check
 * @returns Whether the error is a network error
 *
 * @client Safe for client-side use
 */
export function isNetworkError(error: any): boolean {
  if (error instanceof NetworkError) {
    return true
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true
  }

  if (error && typeof error === "object" && "isNetworkError" in error) {
    return Boolean(error.isNetworkError)
  }

  return false
}

/**
 * Checks if an error is a timeout error
 *
 * @param error - Error to check
 * @returns Whether the error is a timeout error
 *
 * @client Safe for client-side use
 */
export function isTimeoutError(error: any): boolean {
  if (error instanceof TimeoutError) {
    return true
  }

  if (error && error.name === "AbortError") {
    return true
  }

  if (error && error.name === "TimeoutError") {
    return true
  }

  if (error && typeof error === "object" && "isTimeoutError" in error) {
    return Boolean(error.isTimeoutError)
  }

  return false
}

/**
 * Throws an error if a value is undefined or null
 *
 * @param value - Value to check
 * @param message - Optional error message
 * @throws ValidationError if value is undefined or null
 *
 * @client Safe for client-side use
 */
export function throwIfMissing(value: any, message = ValidationMessages.required): void {
  if (value === undefined || value === null) {
    throw new ValidationError(message)
  }
}

/**
 * Throws an error if a value is not of the expected type
 *
 * @param value - Value to check
 * @param type - Expected type
 * @param message - Optional error message
 * @throws ValidationError if value is not of the expected type
 *
 * @client Safe for client-side use
 */
export function assertType(value: any, type: string, message?: string): void {
  const actualType = Array.isArray(value) ? "array" : typeof value

  if (actualType !== type && !(type === "array" && Array.isArray(value))) {
    throw new ValidationError(message || ValidationMessages.type.replace("{type}", type), {
      value: `Type mismatch: expected ${type}, got ${actualType}`,
    })
  }
}

/**
 * Throws an error if a condition is false
 *
 * @param condition - Condition to check
 * @param message - Optional error message
 * @throws ValidationError if condition is false
 *
 * @client Safe for client-side use
 */
export function validateCondition(condition: boolean, message = "Validation failed"): void {
  if (!condition) {
    throw new ValidationError(message)
  }
}

/**
 * Wraps an async function to catch errors
 *
 * @param fn - Async function to wrap
 * @returns Wrapped function that catches errors
 *
 * @example
 * ```typescript
 * const fetchData = catchAsync(async () => {
 *   const response = await fetch('/api/data');
 *   if (!response.ok) throw new Error('Failed to fetch data');
 *   return response.json();
 * });
 * ```
 *
 * @client Safe for client-side use
 */
export function catchAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args)
    } catch (error) {
      throw handleApiError(error)
    }
  }
}

/**
 * Shows an error toast notification
 *
 * @param error - Error to show
 *
 * @client Safe for client-side use
 */
export function showErrorToast(error: any): void {
  const message = parseErrorMessage(error)

  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  })
}

/**
 * Shows a success toast notification
 *
 * @param message - Success message
 *
 * @client Safe for client-side use
 */
export function showSuccessToast(message: string): void {
  toast({
    title: "Success",
    description: message,
    variant: "default",
  })
}

/**
 * Shows a warning toast notification
 *
 * @param message - Warning message
 *
 * @client Safe for client-side use
 */
export function showWarningToast(message: string): void {
  toast({
    title: "Warning",
    description: message,
    variant: "warning",
  })
}
