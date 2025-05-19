/**
 * Error Boundary Component
 *
 * A React error boundary component that catches JavaScript errors anywhere in its
 * child component tree and displays a fallback UI instead of crashing the whole app.
 *
 * Features:
 * - Catches render errors and unhandled promise rejections
 * - Provides a reset mechanism to recover from errors
 * - Supports custom fallback UI
 * - Includes a higher-order component for easy wrapping
 *
 * Dependencies:
 * - React hooks for state management
 */

"use client"

import type React from "react"
import { useEffect, useState } from "react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode)
  onError?: (error: Error) => void
}

/**
 * Error boundary component for handling unexpected errors
 */
export function ErrorBoundary({ children, fallback, onError }: ErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Handler for uncaught errors
    const errorHandler = (event: ErrorEvent) => {
      const error = event.error || new Error(event.message)
      console.error("Unhandled error:", error)
      setError(error)

      if (onError) {
        onError(error)
      }

      // Prevent the error from propagating
      event.preventDefault()
    }

    // Handler for unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      console.error("Unhandled promise rejection:", error)
      setError(error)

      if (onError) {
        onError(error)
      }

      // Prevent the rejection from propagating
      event.preventDefault()
    }

    window.addEventListener("error", errorHandler)
    window.addEventListener("unhandledrejection", rejectionHandler)

    return () => {
      window.removeEventListener("error", errorHandler)
      window.removeEventListener("unhandledrejection", rejectionHandler)
    }
  }, [onError])

  const reset = () => {
    setError(null)
  }

  if (error) {
    if (typeof fallback === "function") {
      return <>{fallback(error, reset)}</>
    }

    return (
      fallback || (
        <div className="p-4 rounded-md bg-red-50 border border-red-200">
          <h3 className="text-lg font-medium text-red-800">Something went wrong</h3>
          <p className="mt-2 text-sm text-red-700">
            {error.message || "An unexpected error occurred. Please try refreshing the page."}
          </p>
          <button
            onClick={reset}
            className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    )
  }

  return <>{children}</>
}

/**
 * Higher-order component that wraps a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryProps, "children"> = {},
): React.ComponentType<P> {
  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  // Set display name for debugging
  const displayName = Component.displayName || Component.name || "Component"
  WithErrorBoundary.displayName = `WithErrorBoundary(${displayName})`

  return WithErrorBoundary
}
