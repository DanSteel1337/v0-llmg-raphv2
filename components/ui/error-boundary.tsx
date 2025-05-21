"use client"

import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { ReactNode } from "react"

/**
 * Error severity levels for categorizing different types of errors
 */
export enum ErrorSeverity {
  LOW = "low", // Minor issues that don't significantly impact functionality
  MEDIUM = "medium", // Issues that impact some functionality but app can still operate
  HIGH = "high", // Serious issues that prevent core functionality
  CRITICAL = "critical", // Fatal errors that completely break the application
}

/**
 * Error types for categorizing different sources of errors
 */
export enum ErrorType {
  API = "api", // Errors from API calls
  RENDERING = "rendering", // Errors during component rendering
  DATA = "data", // Errors related to data processing or validation
  AUTHENTICATION = "auth", // Authentication/authorization errors
  NETWORK = "network", // Network connectivity issues
  UNKNOWN = "unknown", // Unclassified errors
}

/**
 * Interface for error details with enhanced information
 */
export interface ErrorDetails {
  message: string
  severity: ErrorSeverity
  type: ErrorType
  code?: string
  action?: string
  technical?: string
  timestamp: Date
  componentStack?: string
}

/**
 * Props for the ErrorBoundary component
 */
export interface ErrorBoundaryProps {
  /** Custom fallback UI to display when an error occurs */
  fallback?: ReactNode | ((props: { error: ErrorDetails; reset: () => void }) => ReactNode)
  /** Components to be protected by the error boundary */
  children: ReactNode
}

/**
 * Simple Error Boundary using react-error-boundary
 */
export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  // Default fallback UI
  const DefaultFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md mx-auto border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 mb-2">{error.message || "An unexpected error occurred"}</p>
        </CardContent>
        <CardFooter>
          <Button onClick={resetErrorBoundary}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  )

  return (
    <ReactErrorBoundary FallbackComponent={fallback ? () => <>{fallback}</> : DefaultFallback}>
      {children}
    </ReactErrorBoundary>
  )
}

export default ErrorBoundary
