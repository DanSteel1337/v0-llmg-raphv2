/**
 * Shared Error Types
 *
 * Defines the common interfaces and types for error handling across both
 * server and client components of the serverless RAG system.
 *
 * @module types/errors
 * @shared This module is used by both client and server code
 */

/**
 * Standard error codes used throughout the application
 * These codes provide a consistent way to identify different types of errors
 * across both client and server components.
 */
export enum ErrorCode {
  /** Validation errors (e.g., invalid input) */
  VALIDATION_ERROR = "validation_error",

  /** Authentication errors (e.g., not logged in) */
  AUTHENTICATION_ERROR = "authentication_error",
  AUTH_ERROR = "auth_error",
  AUTH_INIT_FAILED = "auth_init_failed",
  INVALID_CREDENTIALS = "invalid_credentials",
  SESSION_EXPIRED = "session_expired",
  SESSION_REFRESH_FAILED = "session_refresh_failed",
  MAGIC_LINK_FAILED = "magic_link_failed",
  SIGNOUT_FAILED = "signout_failed",
  USER_NOT_FOUND = "user_not_found",
  AUTH_USER_FETCH_FAILED = "auth_user_fetch_failed",
  SESSION_FETCH_FAILED = "session_fetch_failed",

  /** Authorization errors (e.g., insufficient permissions) */
  AUTHORIZATION_ERROR = "authorization_error",
  INSUFFICIENT_PERMISSIONS = "insufficient_permissions",
  CONTEXT_ERROR = "context_error",

  /** Resource not found errors */
  NOT_FOUND = "not_found",

  /** Rate limit exceeded errors */
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",

  /** Service errors (e.g., external service failure) */
  SERVICE_ERROR = "service_error",

  /** Processing errors (e.g., document processing failed) */
  PROCESSING_ERROR = "processing_error",

  /** Network errors (e.g., connection failed) */
  NETWORK_ERROR = "network_error",

  /** Timeout errors (e.g., request took too long) */
  TIMEOUT_ERROR = "timeout_error",

  /** Internal server errors */
  INTERNAL_ERROR = "internal_error",
}

/**
 * Base error interface that all application errors should implement
 * This provides a consistent structure for all error types in the system.
 *
 * @example
 * ```typescript
 * class MyError implements IAppError {
 *   name = 'MyError';
 *   message = 'Something went wrong';
 *   code = ErrorCode.INTERNAL;
 *   statusCode = 500;
 *   timestamp = new Date().toISOString();
 *
 *   toJSON() { return { name: this.name, message: this.message }; }
 *   toUserMessage() { return this.message; }
 * }
 * ```
 */
export interface IAppError {
  /** The name of the error class */
  name: string

  /** Human-readable error message */
  message: string

  /** Error code from ErrorCode enum */
  code: string

  /** HTTP status code (if applicable) */
  statusCode: number

  /** ISO timestamp when the error occurred */
  timestamp: string

  /** Additional context information */
  context?: Record<string, any>

  /** Whether the operation can be retried */
  retryable?: boolean

  /**
   * Converts the error to a JSON object for logging
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, any>

  /**
   * Creates a user-friendly error message
   * @returns User-friendly error message
   */
  toUserMessage(): string
}

/**
 * Interface for validation errors
 * Extends the base error interface with field-specific validation errors.
 *
 * @example
 * ```typescript
 * const validationError: IValidationError = {
 *   name: 'ValidationError',
 *   message: 'Invalid input',
 *   code: ErrorCode.VALIDATION,
 *   statusCode: 400,
 *   timestamp: new Date().toISOString(),
 *   fields: { email: 'Invalid email format' },
 *   toJSON: () => ({}),
 *   toUserMessage: () => 'Invalid input: email: Invalid email format'
 * };
 * ```
 */
export interface IValidationError extends IAppError {
  /** Field-specific validation errors */
  fields?: Record<string, string>
}

/**
 * Interface for authentication errors
 * Used when a user is not authenticated or the authentication is invalid.
 */
export interface IAuthError extends IAppError {}

/**
 * Interface for authorization errors
 * Used when a user doesn't have permission to access a resource.
 */
export interface IAuthorizationError extends IAppError {}

/**
 * Interface for not found errors
 * Used when a requested resource cannot be found.
 *
 * @example
 * ```typescript
 * const notFoundError: INotFoundError = {
 *   name: 'NotFoundError',
 *   message: 'Document not found',
 *   code: ErrorCode.NOT_FOUND,
 *   statusCode: 404,
 *   timestamp: new Date().toISOString(),
 *   resource: 'document/123',
 *   toJSON: () => ({}),
 *   toUserMessage: () => 'Document not found'
 * };
 * ```
 */
export interface INotFoundError extends IAppError {
  /** The resource that was not found */
  resource?: string
}

/**
 * Interface for rate limit errors
 * Used when a user has exceeded the allowed rate of requests.
 *
 * @example
 * ```typescript
 * const rateLimitError: IRateLimitError = {
 *   name: 'RateLimitError',
 *   message: 'Too many requests',
 *   code: ErrorCode.RATE_LIMIT,
 *   statusCode: 429,
 *   timestamp: new Date().toISOString(),
 *   retryAfter: 60, // seconds
 *   toJSON: () => ({}),
 *   toUserMessage: () => 'Too many requests, please try again in 60 seconds'
 * };
 * ```
 */
export interface IRateLimitError extends IAppError {
  /** Time in seconds after which to retry */
  retryAfter?: number
}

/**
 * Interface for service errors
 * Used when an external service fails or returns an error.
 *
 * @example
 * ```typescript
 * const serviceError: IServiceError = {
 *   name: 'ServiceError',
 *   message: 'Database connection failed',
 *   code: ErrorCode.SERVICE,
 *   statusCode: 500,
 *   timestamp: new Date().toISOString(),
 *   retryable: true,
 *   toJSON: () => ({}),
 *   toUserMessage: () => 'Service unavailable, please try again later'
 * };
 * ```
 */
export interface IServiceError extends IAppError {
  /** Whether the operation can be retried */
  retryable: boolean
}

/**
 * Interface for processing errors
 * Used when a processing operation fails (e.g., document processing).
 *
 * @example
 * ```typescript
 * const processingError: IProcessingError = {
 *   name: 'ProcessingError',
 *   message: 'Failed to process document',
 *   code: ErrorCode.PROCESSING,
 *   statusCode: 500,
 *   timestamp: new Date().toISOString(),
 *   retryable: true,
 *   step: 'chunking',
 *   toJSON: () => ({}),
 *   toUserMessage: () => 'Failed to process document at chunking step'
 * };
 * ```
 */
export interface IProcessingError extends IAppError {
  /** Whether the operation can be retried */
  retryable: boolean

  /** The processing step that failed */
  step?: string
}

/**
 * Interface for network errors
 * Used when a network request fails (e.g., connection error).
 */
export interface INetworkError extends IAppError {}

/**
 * Interface for timeout errors
 * Used when a request times out.
 */
export interface ITimeoutError extends IAppError {}

/**
 * Standard error response interface for API responses
 * This is the format that API routes should use when returning errors.
 *
 * @example
 * ```typescript
 * const errorResponse: IErrorResponse = {
 *   success: false,
 *   error: 'Invalid input',
 *   code: ErrorCode.VALIDATION,
 *   statusCode: 400,
 *   details: { fields: { email: 'Invalid email format' } },
 *   timestamp: new Date().toISOString()
 * };
 * ```
 */
export interface IErrorResponse {
  /** Always false for error responses */
  success: false

  /** Human-readable error message */
  error: string

  /** Error code from ErrorCode enum */
  code: string

  /** HTTP status code */
  statusCode: number

  /** Additional error details */
  details?: Record<string, any>

  /** ISO timestamp when the error occurred */
  timestamp: string
}

/**
 * Options for creating errors
 * This provides a consistent way to configure error instances.
 */
export interface ErrorOptions {
  /** Custom error code (overrides default) */
  code?: string

  /** HTTP status code */
  statusCode?: number

  /** Additional context information */
  context?: Record<string, any>

  /** Original error that caused this error */
  cause?: Error

  /** Whether the operation can be retried */
  retryable?: boolean

  /** Field-specific validation errors */
  fields?: Record<string, string>

  /** Resource that was not found */
  resource?: string

  /** Time in seconds after which to retry */
  retryAfter?: number

  /** Processing step that failed */
  step?: string
}

/**
 * Type for error handler functions
 * Used for custom error handling logic.
 */
export type ErrorHandler = (error: Error) => void

/**
 * Options for retry mechanism
 * Used to configure retry behavior for operations that might fail.
 *
 * @example
 * ```typescript
 * const retryOptions: RetryOptions = {
 *   maxRetries: 3,
 *   retryableErrors: [NetworkError, TimeoutError],
 *   shouldRetry: (error) => error instanceof NetworkError,
 *   onRetry: (error, attempt) => console.log(`Retry attempt ${attempt}`),
 *   backoff: (attempt) => Math.pow(2, attempt) * 100
 * };
 * ```
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number

  /** Error classes that should trigger a retry */
  retryableErrors?: Array<new (...args: any[]) => Error>

  /** Custom function to determine if an error should trigger a retry */
  shouldRetry?: (error: Error) => boolean

  /** Callback function called before each retry attempt */
  onRetry?: (error: Error, attempt: number) => void

  /** Function to calculate delay between retry attempts */
  backoff?: (attempt: number) => number
}

/**
 * Base App Error class
 * All application-specific errors should extend this class.
 */
export class AppError extends Error implements IAppError {
  name = "AppError"
  code: string
  statusCode: number
  timestamp: string
  context?: Record<string, any>
  retryable?: boolean

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      context?: Record<string, any>
      cause?: Error
      retryable?: boolean
    } = {},
  ) {
    super(message)
    this.code = options.code || ErrorCode.INTERNAL_ERROR
    this.statusCode = options.statusCode || 500
    this.timestamp = new Date().toISOString()
    this.context = options.context
    this.retryable = options.retryable

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Converts the error to a JSON object for API responses and logging
   */
  toJSON(): IErrorResponse {
    return {
      success: false,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.context,
      timestamp: this.timestamp,
    }
  }

  /**
   * Creates a user-friendly error message
   */
  toUserMessage(): string {
    return this.message
  }
}

/**
 * Validation Error
 * Used for input validation errors.
 */
export class ValidationError extends AppError implements IValidationError {
  name = "ValidationError"
  fields?: Record<string, string>

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      context?: Record<string, any>
      fields?: Record<string, string>
    } = {},
  ) {
    super(message, {
      code: options.code || ErrorCode.VALIDATION_ERROR,
      statusCode: options.statusCode || 400,
      context: options.context,
    })
    this.fields = options.fields
  }

  toJSON(): IErrorResponse {
    return {
      ...super.toJSON(),
      details: {
        ...this.context,
        fields: this.fields,
      },
    }
  }

  toUserMessage(): string {
    if (!this.fields) {
      return this.message
    }

    const fieldErrors = Object.entries(this.fields)
      .map(([field, error]) => `${field}: ${error}`)
      .join(", ")

    return `${this.message}: ${fieldErrors}`
  }
}

/**
 * Authentication Error
 * Used for authentication-related errors.
 */
export class AuthenticationError extends AppError implements IAuthError {
  name = "AuthenticationError"

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      context?: Record<string, any>
    } = {},
  ) {
    super(message, {
      code: options.code || ErrorCode.AUTHENTICATION_ERROR,
      statusCode: options.statusCode || 401,
      context: options.context,
    })
  }
}

/**
 * Authorization Error
 * Used when a user doesn't have permission to access a resource.
 */
export class AuthorizationError extends AppError implements IAuthorizationError {
  name = "AuthorizationError"

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      context?: Record<string, any>
    } = {},
  ) {
    super(message, {
      code: options.code || ErrorCode.AUTHORIZATION_ERROR,
      statusCode: options.statusCode || 403,
      context: options.context,
    })
  }
}

/**
 * Not Found Error
 * Used when a requested resource cannot be found.
 */
export class NotFoundError extends AppError implements INotFoundError {
  name = "NotFoundError"
  resource?: string

  constructor(message: string, resource?: string, context?: Record<string, any>) {
    super(message, {
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      context: {
        ...context,
        resource,
      },
    })
    this.resource = resource
  }

  toJSON(): IErrorResponse {
    return {
      ...super.toJSON(),
      details: {
        ...this.context,
        resource: this.resource,
      },
    }
  }
}

/**
 * Rate Limit Error
 * Used when a user has exceeded the allowed rate of requests.
 */
export class RateLimitError extends AppError implements IRateLimitError {
  name = "RateLimitError"
  retryAfter?: number

  constructor(message: string, retryAfter?: number, context?: Record<string, any>) {
    super(message, {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      statusCode: 429,
      context: {
        ...context,
        retryAfter,
      },
    })
    this.retryAfter = retryAfter
  }

  toJSON(): IErrorResponse {
    return {
      ...super.toJSON(),
      details: {
        ...this.context,
        retryAfter: this.retryAfter,
      },
    }
  }

  toUserMessage(): string {
    if (this.retryAfter) {
      return `${this.message} Please try again in ${this.retryAfter} seconds.`
    }
    return this.message
  }
}

/**
 * Service Error
 * Used when an external service fails or returns an error.
 */
export class ServiceError extends AppError implements IServiceError {
  name = "ServiceError"
  retryable: boolean

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      context?: Record<string, any>
      retryable?: boolean
    } = {},
  ) {
    super(message, {
      code: options.code || ErrorCode.SERVICE_ERROR,
      statusCode: options.statusCode || 500,
      context: options.context,
    })
    this.retryable = options.retryable ?? false
  }

  toJSON(): IErrorResponse {
    return {
      ...super.toJSON(),
      details: {
        ...this.context,
        retryable: this.retryable,
      },
    }
  }
}

/**
 * Processing Error
 * Used when a processing operation fails (e.g., document processing).
 */
export class ProcessingError extends AppError implements IProcessingError {
  name = "ProcessingError"
  retryable: boolean
  step?: string

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      context?: Record<string, any>
      retryable?: boolean
      step?: string
    } = {},
  ) {
    super(message, {
      code: options.code || ErrorCode.PROCESSING_ERROR,
      statusCode: options.statusCode || 500,
      context: {
        ...options.context,
        step: options.step,
      },
    })
    this.retryable = options.retryable ?? false
    this.step = options.step
  }

  toJSON(): IErrorResponse {
    return {
      ...super.toJSON(),
      details: {
        ...this.context,
        retryable: this.retryable,
        step: this.step,
      },
    }
  }

  toUserMessage(): string {
    if (this.step) {
      return `${this.message} at ${this.step} step`
    }
    return this.message
  }
}

/**
 * Network Error
 * Used when a network request fails (e.g., connection error).
 */
export class NetworkError extends AppError implements INetworkError {
  name = "NetworkError"

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      context?: Record<string, any>
    } = {},
  ) {
    super(message, {
      code: options.code || ErrorCode.NETWORK_ERROR,
      statusCode: options.statusCode || 503,
      context: options.context,
    })
  }
}

/**
 * Timeout Error
 * Used when a request times out.
 */
export class TimeoutError extends AppError implements ITimeoutError {
  name = "TimeoutError"

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      context?: Record<string, any>
    } = {},
  ) {
    super(message, {
      code: options.code || ErrorCode.TIMEOUT_ERROR,
      statusCode: options.statusCode || 504,
      context: options.context,
    })
  }
}
