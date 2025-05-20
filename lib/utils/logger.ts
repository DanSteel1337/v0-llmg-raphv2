/**
 * Logger Utility
 *
 * Provides structured logging with different log levels and context.
 * Safe for use in Edge runtime.
 */

// Log levels
type LogLevel = "debug" | "info" | "warn" | "error"

// Logger interface
interface Logger {
  debug(message: string, context?: Record<string, any>): void
  info(message: string, context?: Record<string, any>): void
  warn(message: string, context?: Record<string, any>): void
  error(message: string, context?: Record<string, any>): void
}

// Create a logger instance
export const logger: Logger = {
  debug(message: string, context?: Record<string, any>) {
    logMessage("debug", message, context)
  },
  info(message: string, context?: Record<string, any>) {
    logMessage("info", message, context)
  },
  warn(message: string, context?: Record<string, any>) {
    logMessage("warn", message, context)
  },
  error(message: string, context?: Record<string, any>) {
    logMessage("error", message, context)
  },
}

/**
 * Log a message with level and context
 */
function logMessage(level: LogLevel, message: string, context?: Record<string, any>) {
  const timestamp = new Date().toISOString()
  const logObject = {
    timestamp,
    level,
    message,
    ...sanitizeContext(context || {}),
  }

  // Use appropriate console method based on level
  switch (level) {
    case "debug":
      console.debug(JSON.stringify(logObject))
      break
    case "info":
      console.info(JSON.stringify(logObject))
      break
    case "warn":
      console.warn(JSON.stringify(logObject))
      break
    case "error":
      console.error(JSON.stringify(logObject))
      break
  }
}

/**
 * Sanitize context to remove sensitive information and handle circular references
 */
function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}

  // List of keys that might contain sensitive information
  const sensitiveKeys = ["password", "token", "key", "secret", "authorization", "api_key", "apiKey"]

  for (const [key, value] of Object.entries(context)) {
    // Check if this is a sensitive key
    const isKeyPotentiallySensitive = sensitiveKeys.some((sensitiveKey) =>
      key.toLowerCase().includes(sensitiveKey.toLowerCase()),
    )

    if (isKeyPotentiallySensitive && typeof value === "string") {
      // Redact sensitive values
      sanitized[key] =
        value.length > 8 ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : "[REDACTED]"
    } else if (value === null || value === undefined) {
      // Pass through null/undefined
      sanitized[key] = value
    } else if (typeof value === "object") {
      try {
        // Handle objects and arrays, but avoid circular references
        sanitized[key] = JSON.parse(JSON.stringify(value))
      } catch (error) {
        // If circular reference or other JSON error, provide placeholder
        sanitized[key] = "[Complex Object]"
      }
    } else {
      // Pass through primitive values
      sanitized[key] = value
    }
  }

  return sanitized
}
