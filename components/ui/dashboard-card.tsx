import type React from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  isLoading?: boolean
  headerClassName?: string
  contentClassName?: string
  footerClassName?: string
}

export function DashboardCard({
  title,
  description,
  footer,
  children,
  isLoading = false,
  className,
  headerClassName,
  contentClassName,
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
      <CardContent className={cn("px-6", contentClassName)}>
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
          </div>
        ) : (
          children
        )}
      </CardContent>
      {footer && <CardFooter className={cn("border-t px-6 py-4", footerClassName)}>{footer}</CardFooter>}
    </Card>
  )
}
