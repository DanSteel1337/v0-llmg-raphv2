/**
 * API Hook
 *
 * A generic hook for making API requests with loading, error, and data states.
 * Provides a consistent way to handle API calls across the application.
 *
 * Dependencies:
 * - React hooks for state management
 * - React Query for caching and deduplication
 * - use-toast for error notifications
 * - use-auth for authentication handling
 */

"use client"

import { useCallback, useRef, useEffect } from "react"
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from "@tanstack/react-query"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "./use-auth"
import { logger } from "@/lib/utils/logger"

// Types
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

interface ApiError extends Error {
  status?: number
  code?: string
  details?: any
  type: "network" | "validation" | "server" | "auth" | "unknown"
  retryable: boolean
}

interface ApiRequestOptions<TBody = any> {
  body?: TBody
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
  cache?: RequestCache
  credentials?: RequestCredentials
  retry?:
    | boolean
    | number
    | {
        attempts: number
        initialDelay: number
        maxDelay: number
        backoffFactor: number
      }
  timeout?: number
  skipAuth?: boolean
  skipErrorToast?: boolean
  tags?: string[]
}

interface ApiQueryOptions<TData, TError>
  extends Omit<UseQueryOptions<TData, TError, TData, QueryKey>, "queryKey" | "queryFn"> {
  endpoint: string
  requestOptions?: ApiRequestOptions
  queryKey?: string | string[]
  poll?: boolean | number
  keepPreviousData?: boolean
}

interface ApiMutationOptions<TData, TError, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "mutationFn"> {
  endpoint: string
  method?: HttpMethod
  requestOptions?: ApiRequestOptions
  optimisticUpdate?: (variables: TVariables) => void
  rollbackOnError?: (variables: TVariables, context: TContext) => void
}

interface UseApiReturn {
  // Query hooks
  useApiGet: <TData = any, TError = ApiError>(
    options: ApiQueryOptions<TData, TError>,
  ) => {
    data: TData | undefined
    error: TError | null
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
    refetch: () => Promise<TData>
    cancel: () => void
  }

  // Mutation hooks
  useApiPost: <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
    options: ApiMutationOptions<TData, TError, TVariables, TContext>,
  ) => {
    mutate: (variables: TVariables) => Promise<TData>
    data: TData | undefined
    error: TError | null
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
    reset: () => void
    cancel: () => void
  }

  useApiPut: <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
    options: ApiMutationOptions<TData, TError, TVariables, TContext>,
  ) => {
    mutate: (variables: TVariables) => Promise<TData>
    data: TData | undefined
    error: TError | null
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
    reset: () => void
    cancel: () => void
  }

  useApiPatch: <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
    options: ApiMutationOptions<TData, TError, TVariables, TContext>,
  ) => {
    mutate: (variables: TVariables) => Promise<TData>
    data: TData | undefined
    error: TError | null
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
    reset: () => void
    cancel: () => void
  }

  useApiDelete: <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
    options: ApiMutationOptions<TData, TError, TVariables, TContext>,
  ) => {
    mutate: (variables: TVariables) => Promise<TData>
    data: TData | undefined
    error: TError | null
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
    reset: () => void
    cancel: () => void
  }

  // Generic request function
  useApiRequest: <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
    method: HttpMethod,
    options: ApiMutationOptions<TData, TError, TVariables, TContext>,
  ) => {
    mutate: (variables: TVariables) => Promise<TData>
    data: TData | undefined
    error: TError | null
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
    reset: () => void
    cancel: () => void
  }

  // Direct API call functions (not hooks)
  apiGet: <TData = any>(endpoint: string, options?: ApiRequestOptions) => Promise<TData>
  apiPost: <TData = any, TBody = any>(endpoint: string, body?: TBody, options?: ApiRequestOptions) => Promise<TData>
  apiPut: <TData = any, TBody = any>(endpoint: string, body?: TBody, options?: ApiRequestOptions) => Promise<TData>
  apiPatch: <TData = any, TBody = any>(endpoint: string, body?: TBody, options?: ApiRequestOptions) => Promise<TData>
  apiDelete: <TData = any>(endpoint: string, options?: ApiRequestOptions) => Promise<TData>
  apiRequest: <TData = any, TBody = any>(
    method: HttpMethod,
    endpoint: string,
    options?: ApiRequestOptions & { body?: TBody },
  ) => Promise<TData>
}

/**
 * Creates a standardized API error object from various error types
 * @param error - The original error
 * @param endpoint - The API endpoint that was called
 * @returns Standardized ApiError object
 */
function createApiError(error: any, endpoint: string): ApiError {
  // Default error structure
  const apiError: ApiError = {
    name: "ApiError",
    message: error?.message || "An unknown error occurred",
    type: "unknown",
    retryable: false,
  }

  // Handle fetch network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    apiError.message = "Network error: Unable to connect to the server"
    apiError.type = "network"
    apiError.retryable = true
    return apiError
  }

  // Handle AbortError
  if (error.name === "AbortError") {
    apiError.message = "Request was cancelled"
    apiError.type = "network"
    apiError.retryable = false
    return apiError
  }

  // Handle timeout errors
  if (error.name === "TimeoutError") {
    apiError.message = "Request timed out"
    apiError.type = "network"
    apiError.retryable = true
    return apiError
  }

  // Handle response errors
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode
    apiError.status = status

    // Add error details if available
    if (error.data) {
      apiError.details = error.data

      // Use server-provided message if available
      if (error.data.message || error.data.error) {
        apiError.message = error.data.message || error.data.error
      }

      // Use server-provided code if available
      if (error.data.code) {
        apiError.code = error.data.code
      }
    }

    // Categorize by status code
    if (status >= 400 && status < 500) {
      if (status === 401 || status === 403) {
        apiError.type = "auth"
        apiError.retryable = false
      } else if (status === 422 || status === 400) {
        apiError.type = "validation"
        apiError.retryable = false
      } else {
        apiError.type = "client"
        apiError.retryable = false
      }
    } else if (status >= 500) {
      apiError.type = "server"
      apiError.retryable = true
    }
  }

  // Log the error for debugging
  logger.error(`API Error (${apiError.type}) for ${endpoint}:`, {
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
    details: apiError.details,
    originalError: error,
  })

  return apiError
}

/**
 * Builds a URL with query parameters
 * @param endpoint - Base endpoint
 * @param params - Query parameters
 * @returns Formatted URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return endpoint

  const url = new URL(endpoint, window.location.origin)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value))
    }
  })

  return url.pathname + url.search
}

/**
 * Implements a timeout for fetch requests
 * @param promise - The fetch promise
 * @param timeout - Timeout in milliseconds
 * @returns Promise with timeout
 */
function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error("Request timed out")
      error.name = "TimeoutError"
      reject(error)
    }, timeout)

    promise.then(
      (result) => {
        clearTimeout(timeoutId)
        resolve(result)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

/**
 * Masks sensitive data in objects for logging
 * @param data - Data to mask
 * @returns Masked data safe for logging
 */
function maskSensitiveData(data: any): any {
  if (!data) return data

  const sensitiveFields = ["password", "token", "secret", "key", "authorization", "apiKey"]

  if (typeof data === "object" && data !== null) {
    const masked = { ...data }

    Object.keys(masked).forEach((key) => {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        masked[key] = "***REDACTED***"
      } else if (typeof masked[key] === "object" && masked[key] !== null) {
        masked[key] = maskSensitiveData(masked[key])
      }
    })

    return masked
  }

  return data
}

/**
 * Hook for making API requests with standardized error handling and state management
 * @returns API request hooks and functions
 */
export function useApi(): UseApiReturn {
  const { toast } = useToast()
  const { user, getAuthHeader } = useAuth()
  const queryClient = useQueryClient()
  const abortControllers = useRef<Record<string, AbortController>>({})
  const controllerRef = useRef<AbortController | null>(null)

  /**
   * Core request function that handles all API calls
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param options - Request options
   * @returns Promise with response data
   */
  const apiRequest = useCallback(
    async <TData = any, TBody = any>(
      method: HttpMethod,
      endpoint: string,
      options?: ApiRequestOptions & { body?: TBody },
    ): Promise<TData> => {
      const {
        body,
        headers = {},
        params,
        signal,
        cache = "no-cache",
        credentials = "same-origin",
        retry = true,
        timeout = 30000,
        skipAuth = false,
        skipErrorToast = false,
      } = options || {}

      // Create a unique request ID for this call
      const requestId = `${method}:${endpoint}:${JSON.stringify(params)}:${Date.now()}`

      // Create an abort controller if one wasn't provided
      const controller = signal ? undefined : new AbortController()
      if (controller) {
        abortControllers.current[requestId] = controller
      }

      // Build the URL with query parameters
      const url = buildUrl(endpoint, params)

      // Prepare headers
      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...headers,
      }

      // Add auth header if user is logged in and not skipped
      if (!skipAuth && user) {
        const authHeader = await getAuthHeader()
        if (authHeader) {
          requestHeaders["Authorization"] = authHeader
        }
      }

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers: requestHeaders,
        credentials,
        cache,
        signal: signal || controller?.signal,
      }

      // Add body for non-GET requests
      if (method !== "GET" && body !== undefined) {
        requestOptions.body = JSON.stringify(body)
      }

      // Log request in development
      if (process.env.NODE_ENV === "development") {
        logger.debug(`API Request: ${method} ${url}`, {
          headers: maskSensitiveData(requestHeaders),
          body: maskSensitiveData(body),
        })
      }

      try {
        // Make the request with timeout
        const fetchPromise = fetch(url, requestOptions)
        const response = await withTimeout(fetchPromise, timeout)

        // Clean up abort controller
        if (controller) {
          delete abortControllers.current[requestId]
        }

        // Parse response
        let data: any
        const contentType = response.headers.get("content-type")

        if (contentType?.includes("application/json")) {
          data = await response.json()
        } else if (contentType?.includes("text/")) {
          data = await response.text()
        } else {
          data = await response.blob()
        }

        // Log response in development
        if (process.env.NODE_ENV === "development") {
          logger.debug(`API Response: ${method} ${url} ${response.status}`, {
            data: maskSensitiveData(data),
          })
        }

        // Handle error responses
        if (!response.ok) {
          const error: any = new Error(`API error: ${response.status} ${response.statusText}`)
          error.status = response.status
          error.data = data
          throw error
        }

        // For our API format, extract the data property if it exists
        if (data && typeof data === "object" && "success" in data) {
          if (data.success === false) {
            const error: any = new Error(data.error || "API returned success: false")
            error.status = response.status
            error.data = data
            throw error
          }

          // Return the data property if it exists, otherwise the whole response
          return (data.data !== undefined ? data.data : data) as TData
        }

        return data as TData
      } catch (error: any) {
        // Clean up abort controller
        if (controller) {
          delete abortControllers.current[requestId]
        }

        // Don't process aborted requests as errors
        if (error.name === "AbortError") {
          throw error
        }

        // Create standardized error
        const apiError = createApiError(error, url)

        // Show toast for errors unless skipped
        if (!skipErrorToast) {
          toast.error({
            title: "Error",
            description: apiError.message,
          })
        }

        // Implement retry logic if enabled
        if (apiError.retryable && retry) {
          const retryConfig =
            typeof retry === "object"
              ? retry
              : {
                  attempts: typeof retry === "number" ? retry : 3,
                  initialDelay: 1000,
                  maxDelay: 10000,
                  backoffFactor: 2,
                }

          let retryAttempt = 0
          let retryDelay = retryConfig.initialDelay

          while (retryAttempt < retryConfig.attempts) {
            retryAttempt++

            // Log retry attempt
            logger.info(`Retrying API request (${retryAttempt}/${retryConfig.attempts}): ${method} ${url}`)

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, retryDelay))

            // Increase delay for next attempt (with max limit)
            retryDelay = Math.min(retryDelay * retryConfig.backoffFactor, retryConfig.maxDelay)

            try {
              // Retry the request (without retry to avoid infinite loops)
              return await apiRequest<TData, TBody>(method, endpoint, {
                ...options,
                retry: false,
              })
            } catch (retryError) {
              // If this is the last attempt, throw the error
              if (retryAttempt >= retryConfig.attempts) {
                throw retryError
              }
              // Otherwise continue to the next retry
            }
          }
        }

        throw apiError
      }
    },
    [user, getAuthHeader, toast],
  )

  /**
   * Convenience method for GET requests
   */
  const apiGet = useCallback(
    <TData = any>(endpoint: string, options?: ApiRequestOptions): Promise<TData> => {
      return apiRequest<TData>("GET", endpoint, options)
    },
    [apiRequest],
  )

  /**
   * Convenience method for POST requests
   */
  const apiPost = useCallback(
    <TData = any, TBody = any>(endpoint: string, body?: TBody, options?: ApiRequestOptions): Promise<TData> => {
      return apiRequest<TData, TBody>("POST", endpoint, { ...options, body })
    },
    [apiRequest],
  )

  /**
   * Convenience method for PUT requests
   */
  const apiPut = useCallback(
    <TData = any, TBody = any>(endpoint: string, body?: TBody, options?: ApiRequestOptions): Promise<TData> => {
      return apiRequest<TData, TBody>("PUT", endpoint, { ...options, body })
    },
    [apiRequest],
  )

  /**
   * Convenience method for PATCH requests
   */
  const apiPatch = useCallback(
    <TData = any, TBody = any>(endpoint: string, body?: TBody, options?: ApiRequestOptions): Promise<TData> => {
      return apiRequest<TData, TBody>("PATCH", endpoint, { ...options, body })
    },
    [apiRequest],
  )

  /**
   * Convenience method for DELETE requests
   */
  const apiDelete = useCallback(
    <TData = any>(endpoint: string, options?: ApiRequestOptions): Promise<TData> => {
      return apiRequest<TData>("DELETE", endpoint, options)
    },
    [apiRequest],
  )

  /**
   * Hook for GET requests using React Query
   */
  const useApiGet = useCallback(
    <TData = any, TError = ApiError>(options: ApiQueryOptions<TData, TError>) => {
      const { endpoint, requestOptions, queryKey = endpoint, poll, enabled = true, ...queryOptions } = options

      // Create a unique query key
      const fullQueryKey = Array.isArray(queryKey) ? queryKey : [queryKey, requestOptions?.params]

      // Set up the query
      const query = useQuery<TData, TError>({
        queryKey: fullQueryKey,
        queryFn: async () => {
          // Create a new abort controller for this request
          controllerRef.current = new AbortController()

          try {
            return await apiGet<TData>(endpoint, {
              ...requestOptions,
              signal: controllerRef.current.signal,
            })
          } catch (error) {
            // Convert error to expected format
            throw error as TError
          }
        },
        enabled,
        refetchInterval: poll === true ? 30000 : typeof poll === "number" ? poll : undefined,
        ...queryOptions,
      })

      // Cancel function
      const cancel = useCallback(() => {
        if (controllerRef.current) {
          controllerRef.current.abort()
          controllerRef.current = null
        }
      }, [])

      // Clean up on unmount
      useEffect(() => {
        return () => {
          cancel()
        }
      }, [cancel])

      return {
        data: query.data,
        error: query.error || null,
        isLoading: query.isLoading,
        isError: query.isError,
        isSuccess: query.isSuccess,
        refetch: query.refetch,
        cancel,
      }
    },
    [apiGet],
  )

  /**
   * Generic hook for mutation requests (POST, PUT, PATCH, DELETE)
   */
  const useApiMutation = useCallback(
    <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
      method: HttpMethod,
      options: ApiMutationOptions<TData, TError, TVariables, TContext>,
    ) => {
      const { endpoint, requestOptions, optimisticUpdate, rollbackOnError, ...mutationOptions } = options

      // Set up the mutation
      const mutation = useMutation<TData, TError, TVariables, TContext>({
        mutationFn: async (variables: TVariables) => {
          // Create a new abort controller for this request
          controllerRef.current = new AbortController()

          try {
            // For methods that accept a body
            if (method === "POST" || method === "PUT" || method === "PATCH") {
              return await apiRequest<TData, TVariables>(method, endpoint, {
                ...requestOptions,
                body: variables,
                signal: controllerRef.current.signal,
              })
            }
            // For DELETE or other methods without a body
            else {
              return await apiRequest<TData>(method, endpoint, {
                ...requestOptions,
                params: variables as any, // Pass variables as query params for DELETE
                signal: controllerRef.current.signal,
              })
            }
          } catch (error) {
            // Convert error to expected format
            throw error as TError
          }
        },
        // Handle optimistic updates if provided
        onMutate: async (variables) => {
          if (optimisticUpdate) {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries()

            // Apply optimistic update
            optimisticUpdate(variables)

            return variables as unknown as TContext
          }
          return undefined
        },
        // Handle rollback on error if provided
        onError: (error, variables, context) => {
          if (rollbackOnError && context) {
            rollbackOnError(variables, context)
          }

          // Call the provided onError if it exists
          if (mutationOptions.onError) {
            mutationOptions.onError(error, variables, context)
          }
        },
        ...mutationOptions,
      })

      // Cancel function
      const cancel = useCallback(() => {
        if (controllerRef.current) {
          controllerRef.current.abort()
          controllerRef.current = null
        }
      }, [])

      // Clean up on unmount
      useEffect(() => {
        return () => {
          cancel()
        }
      }, [cancel])

      return {
        mutate: mutation.mutate,
        mutateAsync: mutation.mutateAsync,
        data: mutation.data,
        error: mutation.error || null,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        isSuccess: mutation.isSuccess,
        reset: mutation.reset,
        cancel,
      }
    },
    [apiRequest, queryClient],
  )

  /**
   * Hook for POST requests
   */
  const useApiPost = useCallback(
    <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
      options: ApiMutationOptions<TData, TError, TVariables, TContext>,
    ) => {
      return useApiMutation<TData, TError, TVariables, TContext>("POST", options)
    },
    [useApiMutation],
  )

  /**
   * Hook for PUT requests
   */
  const useApiPut = useCallback(
    <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
      options: ApiMutationOptions<TData, TError, TVariables, TContext>,
    ) => {
      return useApiMutation<TData, TError, TVariables, TContext>("PUT", options)
    },
    [useApiMutation],
  )

  /**
   * Hook for PATCH requests
   */
  const useApiPatch = useCallback(
    <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
      options: ApiMutationOptions<TData, TError, TVariables, TContext>,
    ) => {
      return useApiMutation<TData, TError, TVariables, TContext>("PATCH", options)
    },
    [useApiMutation],
  )

  /**
   * Hook for DELETE requests
   */
  const useApiDelete = useCallback(
    <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
      options: ApiMutationOptions<TData, TError, TVariables, TContext>,
    ) => {
      return useApiMutation<TData, TError, TVariables, TContext>("DELETE", options)
    },
    [useApiMutation],
  )

  /**
   * Generic hook for any request method
   */
  const useApiRequest = useCallback(
    <TData = any, TError = ApiError, TVariables = any, TContext = unknown>(
      method: HttpMethod,
      options: ApiMutationOptions<TData, TError, TVariables, TContext>,
    ) => {
      return useApiMutation<TData, TError, TVariables, TContext>(method, options)
    },
    [useApiMutation],
  )

  // Clean up any pending requests on unmount
  useEffect(() => {
    return () => {
      // Abort all pending requests
      Object.values(abortControllers.current).forEach((controller) => {
        controller.abort()
      })
      abortControllers.current = {}
    }
  }, [])

  return {
    // Query hooks
    useApiGet,

    // Mutation hooks
    useApiPost,
    useApiPut,
    useApiPatch,
    useApiDelete,
    useApiRequest,

    // Direct API call functions
    apiGet,
    apiPost,
    apiPut,
    apiPatch,
    apiDelete,
    apiRequest,
  }
}

/**
 * Type for API error responses
 */
export type { ApiError }

/**
 * Type for API request options
 */
export type { ApiRequestOptions }

/**
 * Type for API query options
 */
export type { ApiQueryOptions }

/**
 * Type for API mutation options
 */
export type { ApiMutationOptions }
