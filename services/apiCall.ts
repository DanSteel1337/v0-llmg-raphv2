/**
 * API Call Utility
 *
 * Standard utility for making API calls with consistent error handling.
 * Ensures all API calls follow the same response format and error patterns.
 * 
 * IMPORTANT:
 * - ALWAYS check for success property in responses
 * - ALWAYS handle network errors properly
 * - ALWAYS validate response body
 * - ALWAYS log detailed error information for debugging
 * - NEVER expose sensitive information in logs
 * 
 * @module services/apiCall
 */

/**
 * Make an API call with standardized error handling
 *
 * @param url API endpoint URL
 * @param options Request options matching the Fetch API
 * @returns Typed response data
 * @throws Error with message from API or fetch operation
 */
export async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    // Add default headers if not provided
    const headers = {
      ...(options?.headers || {}),
    }

    // Execute fetch operation with combined options
    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Log non-OK responses for debugging
    if (!response.ok) {
      console.error(`API call failed: ${response.status} ${response.statusText}`, { url, options })

      // Try to parse error response
      let errorData: any
      try {
        errorData = await response.json()
      } catch (e) {
        try {
          errorData = await response.text()
        } catch (e2) {
          errorData = { error: `${response.status} ${response.statusText}` }
        }
      }

      // Throw error with details
      throw new Error(errorData?.error || errorData?.message || `API error: ${response.status} ${response.statusText}`)
    }

    // Handle empty responses (204 No Content or empty response body)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return { success: true } as unknown as T
    }

    // Parse response as JSON
    try {
      const data = await response.json()
      
      // IMPROVED: Ensure the response always has a success property if it's an object and doesn't already have one
      if (data && typeof data === 'object' && !('success' in data)) {
        data.success = true;
      }
      
      return data as T
    } catch (error) {
      console.error("Error parsing API response:", error)
      throw new Error("Invalid response format")
    }
  } catch (error) {
    // Log and rethrow
    console.error(`API call error for ${url}:`, error)
    throw error
  }
}
