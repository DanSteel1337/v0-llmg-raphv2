/**
 * Dashboard Card Component
 *
 * A flexible, reusable card component for dashboard widgets in the serverless RAG system.
 * Provides consistent styling and behavior for dashboard elements with customization options.
 *
 * Features:
 * - Customizable title and description
 * - Optional icon and action buttons
 * - Loading, error, and empty states
 * - Responsive design
 * - Accessibility support
 *
 * @module components/ui/dashboard-card
 */

"use client"

import type React from "react"

import { forwardRef, useState, useCallback, memo } from "react"
import { Loader2, RefreshCw, Maximize2, Minimize2, X, AlertCircle } from "lucide-react"
import { ErrorBoundary } from "@/components/ui/error-boundary"

/**
 * Color variant options for the dashboard card
 */
export type CardVariant = "default" | "primary" | "secondary" | "success" | "warning" | "error" | "info"

/**
 * Size options for the dashboard card
 */
export type CardSize = "sm" | "md" | "lg" | "xl" | "full"

/**
 * Height options for the dashboard card
 */
export type CardHeight = "auto" | "fixed" | "full"

/**
 * Dashboard Card Props Interface
 */
export interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card title */
  title?: React.ReactNode
  /** Card description */
  description?: React.ReactNode
  /** Card icon */
  icon?: React.ReactNode
  /** Card content */
  children: React.ReactNode
  /** Card footer content */
  footer?: React.ReactNode
  /** Card header actions */
  actions?: React.ReactNode
  /** Loading state */
  isLoading?: boolean
  /** Error state */
  error?: Error | string | null
  /** Empty state message */
  emptyState?: React.ReactNode
  /** Color variant */
  variant?: CardVariant
  /** Card size */
  size?: CardSize
  /** Card height */
  height?: CardHeight | number
  /** Whether the card is collapsible */
  collapsible?: boolean
  /** Whether the card is initially collapsed */
  defaultCollapsed?: boolean
  /** Whether the card is expandable to full screen */
  expandable?: boolean
  /** Whether the card is closable */
  closable?: boolean
  /** Whether the card has a refresh button */
  refreshable?: boolean
  /** Callback when refresh button is clicked */
  onRefresh?: () => void
  /** Callback when close button is clicked */
  onClose?: () => void
  /** Whether the card has a border */
  bordered?: boolean
  /** Whether the card has a shadow */
  shadowed?: boolean
  /** Custom class name */
  className?: string
  /** Custom style */
  style?: React.CSSProperties
  /** ID for the card */
  id?: string
}

/**
 * Dashboard Card Loading Component
 */
const CardLoading = memo(function CardLoading() {
  return (
    <div className="flex flex-col items-center justify-center p-6 h-full">
      <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" aria-hidden="true" />
      <p className="text-sm text-gray-500">Loading content...</p>
    </div>
  )
})

/**
 * Dashboard Card Error Component
 */
const CardError = memo(function CardError({
  error,
  onRetry,
}: {
  error: Error | string
  onRetry?: () => void
}) {
  const errorMessage = typeof error === "string" ? error : error.message

  return (
    <div className="flex flex-col items-center justify-center p-6 h-full">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 w-full max-w-md">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error loading content</h3>
            <div className="mt-2 text-sm text-red-700">{errorMessage}</div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 text-sm font-medium text-red-800 hover:text-red-900 inline-flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

/**
 * Dashboard Card Empty State Component
 */
const CardEmptyState = memo(function CardEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 h-full">
      <div className="text-center max-w-md">{children}</div>
    </div>
  )
})

/**
 * Get variant classes based on the variant prop
 */
function getVariantClasses(variant: CardVariant): string {
  switch (variant) {
    case "primary":
      return "bg-blue-50 border-blue-200"
    case "secondary":
      return "bg-purple-50 border-purple-200"
    case "success":
      return "bg-green-50 border-green-200"
    case "warning":
      return "bg-yellow-50 border-yellow-200"
    case "error":
      return "bg-red-50 border-red-200"
    case "info":
      return "bg-cyan-50 border-cyan-200"
    default:
      return "bg-white border-gray-200"
  }
}

/**
 * Get size classes based on the size prop
 */
function getSizeClasses(size: CardSize): string {
  switch (size) {
    case "sm":
      return "max-w-sm"
    case "md":
      return "max-w-md"
    case "lg":
      return "max-w-lg"
    case "xl":
      return "max-w-xl"
    case "full":
      return "w-full"
    default:
      return "w-full"
  }
}

/**
 * Get height classes based on the height prop
 */
function getHeightClasses(height: CardHeight | number): string {
  if (typeof height === "number") {
    return `h-[${height}px]`
  }

  switch (height) {
    case "auto":
      return "h-auto"
    case "fixed":
      return "h-64"
    case "full":
      return "h-full"
    default:
      return "h-auto"
  }
}

/**
 * Dashboard Card Component
 *
 * A flexible, reusable card component for dashboard widgets.
 */
export const DashboardCard = memo(
  forwardRef<HTMLDivElement, DashboardCardProps>(function DashboardCard(
    {
      title,
      description,
      icon,
      children,
      footer,
      actions,
      isLoading = false,
      error = null,
      emptyState = null,
      variant = "default",
      size = "full",
      height = "auto",
      collapsible = false,
      defaultCollapsed = false,
      expandable = false,
      closable = false,
      refreshable = false,
      onRefresh,
      onClose,
      bordered = true,
      shadowed = true,
      className = "",
      style,
      id,
      ...rest
    },
    ref,
  ) {
    // State for collapsible and expandable functionality
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
    const [isExpanded, setIsExpanded] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Get classes based on props
    const variantClasses = getVariantClasses(variant)
    const sizeClasses = getSizeClasses(size)
    const heightClasses = getHeightClasses(height)

    // Handle refresh click
    const handleRefresh = useCallback(async () => {
      if (onRefresh) {
        setIsRefreshing(true)
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
        }
      }
    }, [onRefresh])

    // Handle close click
    const handleClose = useCallback(() => {
      if (onClose) {
        onClose()
      }
    }, [onClose])

    // Handle collapse toggle
    const handleCollapseToggle = useCallback(() => {
      setIsCollapsed((prev) => !prev)
    }, [])

    // Handle expand toggle
    const handleExpandToggle = useCallback(() => {
      setIsExpanded((prev) => !prev)
    }, [])

    // Determine if we should show the header
    const showHeader = title || description || icon || actions || collapsible || expandable || closable || refreshable

    // Determine content to render
    let content = children
    if (isLoading || isRefreshing) {
      content = <CardLoading />
    } else if (error) {
      content = <CardError error={error} onRetry={refreshable ? handleRefresh : undefined} />
    } else if (emptyState && !children) {
      content = <CardEmptyState>{emptyState}</CardEmptyState>
    }

    return (
      <ErrorBoundary>
        <div
          ref={ref}
          className={`
            ${variantClasses}
            ${sizeClasses}
            ${heightClasses}
            ${bordered ? "border" : ""}
            ${shadowed ? "shadow-md" : ""}
            ${isExpanded ? "fixed inset-4 z-50" : "relative"}
            rounded-lg overflow-hidden transition-all duration-200 ease-in-out
            ${className}
          `}
          style={{
            ...style,
            ...(isExpanded ? { maxWidth: "none", maxHeight: "none" } : {}),
          }}
          id={id}
          {...rest}
        >
          {/* Card Header */}
          {showHeader && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                {icon && <div className="flex-shrink-0">{icon}</div>}
                <div>
                  {title && (
                    <h3 className="text-lg font-medium text-gray-900" id={`${id}-title`}>
                      {title}
                    </h3>
                  )}
                  {description && <p className="text-sm text-gray-500">{description}</p>}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {actions && <div className="flex items-center space-x-2">{actions}</div>}

                {refreshable && (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="p-1 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Refresh"
                    disabled={isLoading || isRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                  </button>
                )}

                {collapsible && (
                  <button
                    type="button"
                    onClick={handleCollapseToggle}
                    className="p-1 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-expanded={!isCollapsed}
                    aria-controls={`${id}-content`}
                    aria-label={isCollapsed ? "Expand" : "Collapse"}
                  >
                    {isCollapsed ? (
                      <Maximize2 className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Minimize2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                )}

                {expandable && (
                  <button
                    type="button"
                    onClick={handleExpandToggle}
                    className="p-1 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Maximize2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                )}

                {closable && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Card Content */}
          <div
            className={`${isCollapsed ? "h-0 p-0 overflow-hidden" : "p-4"} transition-all duration-200 ease-in-out`}
            id={`${id}-content`}
            aria-labelledby={title ? `${id}-title` : undefined}
            role="region"
            aria-hidden={isCollapsed}
          >
            {content}
          </div>

          {/* Card Footer */}
          {footer && !isCollapsed && <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">{footer}</div>}

          {/* Overlay for expanded state */}
          {isExpanded && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              aria-hidden="true"
              onClick={handleExpandToggle}
            />
          )}
        </div>
      </ErrorBoundary>
    )
  }),
)

DashboardCard.displayName = "DashboardCard"

export default DashboardCard
