/**
 * Dashboard Card Component
 *
 * A reusable card component for dashboard widgets with consistent styling,
 * header, and action buttons.
 *
 * Dependencies:
 * - None
 */

import type React from "react"

interface DashboardCardProps {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  linkTo?: string
  linkText?: string
  isLoading?: boolean
}

export function DashboardCard({
  title,
  description,
  children,
  footer,
  className = "",
  linkTo,
  linkText = "View All",
  isLoading = false,
}: DashboardCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
        </div>
      </div>

      <div className={`p-4 ${isLoading ? "opacity-50" : ""}`}>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          children
        )}
      </div>

      {footer && <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">{footer}</div>}
    </div>
  )
}
