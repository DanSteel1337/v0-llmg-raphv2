/**
 * API Call Utility
 *
 * Provides a standardized way to make API calls with error handling and response formatting.
 * Centralizes common API operations for consistent behavior across the application.
 */

/**
 * Make an API call with standardized error handling
 * 
 * @param url API endpoint URL
 * @param options Request options matching the Fetch API
 * @returns Typed response data
 * @throws Error with message from API or fetch operation
 */
export async function apiCall<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    // Add default headers if not present
    const headers = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };

    // Execute fetch operation with combined options
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle unsuccessful status codes
    if (!response.ok) {
      let errorMessage: string;
      
      try {
        // Try to parse error response as JSON
        const errorData = await response.json();
        errorMessage = errorData?.error || errorData?.message || `API error: ${response.status} ${response.statusText}`;
      } catch (e) {
        // If JSON parsing fails, use status text
        errorMessage = `API error: ${response.status} ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    // Handle empty responses (204 No Content or empty response body)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return { success: true } as unknown as T;
    }

    // Parse response text
    const text = await response.text();
    if (!text) {
      return { success: true } as unknown as T;
    }

    // Parse JSON
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error("Failed to parse JSON response:", error);
      throw new Error("Invalid JSON response from server");
    }
  } catch (error) {
    // Rethrow with descriptive message
    console.error("API call failed:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}
