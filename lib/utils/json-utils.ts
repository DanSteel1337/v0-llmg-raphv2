/**
 * JSON Utilities
 *
 * Utilities for safely handling JSON operations.
 */

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  if (!text) {
    return fallback
  }

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.error("Failed to parse JSON:", error)
    return fallback
  }
}

/**
 * Safely stringify JSON with error handling
 */
export function safeJsonStringify(data: any, fallback = "{}"): string {
  if (data === undefined || data === null) {
    return fallback
  }

  try {
    return JSON.stringify(data)
  } catch (error) {
    console.error("Failed to stringify JSON:", error)
    return fallback
  }
}
