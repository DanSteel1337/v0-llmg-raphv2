/**
 * Logger Utility
 *
 * Provides standardized logging functions with prefixes and formatting.
 */

// Log levels
type LogLevel = "debug" | "info" | "warn" | "error"

// Log a message with context
export function log(level: LogLevel, message: string, context?: Record<string, any>): void {
  const timestamp = new Date().toISOString()
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`

  switch (level) {
    case "debug":
      console.debug(formattedMessage, context || "")
      break
    case "info":
      console.log(formattedMessage, context || "")
      break
    case "warn":
      console.warn(formattedMessage, context || "")
      break
    case "error":
      console.error(formattedMessage, context || "")
      break
  }
}

// Shorthand functions
export const debug = (message: string, context?: Record<string, any>) => log("debug", message, context)
export const info = (message: string, context?: Record<string, any>) => log("info", message, context)
export const warn = (message: string, context?: Record<string, any>) => log("warn", message, context)
export const error = (message: string, context?: Record<string, any>) => log("error", message, context)

// Log the embedding configuration
export function logEmbeddingConfig(model: string, dimensions: number, indexName: string, host: string): void {
  info("Embedding configuration initialized", {
    model,
    dimensions,
    indexName,
    host: host.split(".")[0], // Only log the first part for security
  })
}
