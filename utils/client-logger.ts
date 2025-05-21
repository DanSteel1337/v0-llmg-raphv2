/**
 * Client Logger
 *
 * A browser-safe logging utility that provides consistent logging for client-side code.
 * This logger is designed to be a drop-in replacement for the server-side logger
 * but is safe to use in browser environments.
 *
 * @module utils/client-logger
 * @client This utility is designed for client-side use only
 */

// Define log levels
type LogLevel = "debug" | "info" | "warn" | "error"

// Define logger interface to match server-side logger
interface ILogger {
  debug(message: string, context?: Record<string, any>): void
  info(message: string, context?: Record<string, any>): void
  warn(message: string, context?: Record<string, any>): void
  error(message: string, context?: Record<string, any>): void
}

/**
 * Determines if the current environment is a browser
 */
const isBrowser = typeof window !== "undefined"

/**
 * Formats a log message with context
 *
 * @param message - The log message
 * @param context - Additional context information
 * @returns Formatted log message
 */
function formatLogMessage(message: string, context?: Record<string, any>): string {
  if (!context || Object.keys(context).length === 0) {
    return message
  }

  try {
    return `${message} ${JSON.stringify(context)}`
  } catch (error) {
    return `${message} [Context serialization failed]`
  }
}

/**
 * Client-side logger implementation
 */
class ClientLogger implements ILogger {
  /**
   * Log a debug message
   *
   * @param message - The log message
   * @param context - Additional context information
   */
  debug(message: string, context?: Record<string, any>): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatLogMessage(message, context))
    }
  }

  /**
   * Log an info message
   *
   * @param message - The log message
   * @param context - Additional context information
   */
  info(message: string, context?: Record<string, any>): void {
    console.info(formatLogMessage(message, context))
  }

  /**
   * Log a warning message
   *
   * @param message - The log message
   * @param context - Additional context information
   */
  warn(message: string, context?: Record<string, any>): void {
    console.warn(formatLogMessage(message, context))
  }

  /**
   * Log an error message
   *
   * @param message - The log message
   * @param context - Additional context information
   */
  error(message: string, context?: Record<string, any>): void {
    console.error(formatLogMessage(message, context))
  }
}

/**
 * Create a singleton instance of the client logger
 */
export const clientLogger: ILogger = new ClientLogger()

/**
 * Export a logger that matches the server-side logger interface
 * This allows for consistent usage between server and client code
 */
export const logger = clientLogger
