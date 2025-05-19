/**
 * API Call Utility
 *
 * Provides a standardized way to make API calls with error handling.
 */

/**
 * Make an API call with standardized error handling
 */
export async function apiCall<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
      },
    })

    if (!response.ok) {
      // Try to parse error response
      let errorData
      try {
        // Check if there's content to parse
        const text = await response.text()
        if (text) {
          errorData = JSON.parse(text)
        } else {
          throw new Error(`API error: ${response.status} ${response.statusText}`)
        }
      } catch (e) {
        // If we can't parse JSON, use status text
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      // Throw error with message from API if available
      throw new Error(errorData?.error || errorData?.message || `API error: ${response.status} ${response.statusText}`)
    }

    // For 204 No Content responses or empty responses
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return { success: true } as unknown as T
    }

    // Check if there's content to parse
    const text = await response.text()
    if (!text) {
      return { success: true } as unknown as T
    }

    // Parse JSON
    try {
      return JSON.parse(text)
    } catch (error) {
      console.error("Failed to parse JSON response:", error)
      throw new Error("Invalid JSON response from server")
    }
  } catch (error) {
    console.error("API call failed:", error)
    throw error
  }
}
