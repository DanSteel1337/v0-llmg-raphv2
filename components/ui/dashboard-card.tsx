import type React from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  isLoading?: boolean
  className?: string
  contentClassName?: string
  headerClassName?: string
  footerClassName?: string
}

export function DashboardCard({
  title,
  description,
  footer,
  children,
  isLoading,
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  ...props
}: DashboardCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)} {...props}>
      {(title || description) && (
        <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 pb-2", headerClassName)}>
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn("px-6 pt-2", contentClassName)}>
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </div>
        ) : (
          children
        )}
      </CardContent>
      {footer && <CardFooter className={cn("border-t px-6 py-4", footerClassName)}>{footer}</CardFooter>}
    </Card>
  )
}
