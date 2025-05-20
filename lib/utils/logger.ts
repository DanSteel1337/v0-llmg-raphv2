/**
 * Logger Utility
 *
 * Provides consistent logging across the application with support for
 * different log levels and structured logging.
 *
 * In production, this could be extended to send logs to a service like
 * Vercel Logs, LogDNA, or another logging service.
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LoggerOptions {
  level?: LogLevel
  prefix?: string
}

class Logger {
  private level: LogLevel
  private prefix: string

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || "info"
    this.prefix = options.prefix || "LLMGraph"
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    }

    return levels[level] >= levels[this.level]
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const dataString = data ? ` ${JSON.stringify(data)}` : ""
    return `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}] ${message}${dataString}`
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, data))
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message, data))
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, data))
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, data))
    }
  }
}

// Export a singleton instance
export const logger = new Logger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  prefix: "LLMGraph",
})
