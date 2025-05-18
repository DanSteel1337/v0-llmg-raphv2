"use client"

import { useState, useEffect } from "react"
import { CheckCircle, AlertCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function SystemStatus() {
  const [status, setStatus] = useState<"operational" | "degraded" | "down">("operational")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call to check system status
    const checkStatus = async () => {
      try {
        // This would be a real API call in production
        // const response = await fetch('/api/system/status')
        // const data = await response.json()
        // setStatus(data.status)

        // Simulate API response
        setStatus("operational")
        setLoading(false)
      } catch (error) {
        console.error("Failed to fetch system status:", error)
        setStatus("degraded")
        setLoading(false)
      }
    }

    checkStatus()
    // Set up polling every 60 seconds
    const interval = setInterval(checkStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div className="h-4 w-4 animate-pulse rounded-full bg-muted"></div>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          {status === "operational" ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : status === "degraded" ? (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p>
            System Status:{" "}
            {status === "operational"
              ? "All systems operational"
              : status === "degraded"
                ? "Some services degraded"
                : "System outage detected"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
