/**
 * Analytics Hook
 *
 * Custom hook for fetching and managing analytics data with comprehensive filtering,
 * data transformation, and export capabilities.
 *
 * Features:
 * - React Query integration for efficient data fetching and caching
 * - Time range and data type filtering
 * - Data transformation for visualization-ready formats
 * - Auto-refresh with configurable intervals
 * - Data export in multiple formats (CSV, JSON)
 * - Comprehensive error handling and loading states
 * - API health monitoring
 *
 * Dependencies:
 * - @/services/client-api-service for API calls
 * - @/types for analytics data types
 * - react-query for data fetching and caching
 *
 * @module hooks/use-analytics
 */

"use client"

import { useState, useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchAnalytics, checkApiHealth } from "@/services/client-api-service"
import type { AnalyticsData, TimeSeriesData, ChartData } from "@/types"

// Time range options
export type TimeRange = "day" | "week" | "month" | "custom"

// Data type options
export type DataType = "all" | "documents" | "search" | "chat"

// Export format options
export type ExportFormat = "json" | "csv"

// Analytics hook parameters
export interface UseAnalyticsParams {
  userId: string
  initialTimeRange?: TimeRange
  initialDataType?: DataType
  initialStartDate?: string
  initialEndDate?: string
  autoRefreshInterval?: number // in milliseconds, 0 to disable
  detailed?: boolean
}

// Analytics hook return type
export interface UseAnalyticsReturn {
  // Data
  analytics: AnalyticsData | null
  chartData: {
    documents: ChartData
    search: ChartData
    chat: ChartData
    system: ChartData
  }

  // State
  isLoading: boolean
  error: Error | null
  isFetching: boolean
  dataTimestamp: Date | null

  // Filters
  timeRange: TimeRange
  dataType: DataType
  startDate: string | null
  endDate: string | null
  detailed: boolean

  // Actions
  refreshAnalytics: () => Promise<void>
  setTimeRange: (range: TimeRange) => void
  setDataType: (type: DataType) => void
  setDateRange: (start: string, end: string) => void
  setAutoRefreshInterval: (interval: number) => void
  exportData: (format: ExportFormat) => void

  // Health checks
  pineconeApiHealthy: boolean | null
  openaiApiHealthy: boolean | null
  isCheckingHealth: boolean
  healthErrors: {
    pinecone?: string | null
    openai?: string | null
  }
  checkHealth: () => Promise<void>
}

/**
 * Hook for analytics functionality with comprehensive filtering and data transformation
 *
 * @param params Configuration parameters for the hook
 * @returns Analytics state and methods
 */
export function useAnalytics({
  userId,
  initialTimeRange = "week",
  initialDataType = "all",
  initialStartDate,
  initialEndDate,
  autoRefreshInterval = 0,
  detailed = false,
}: UseAnalyticsParams): UseAnalyticsReturn {
  // React Query client
  const queryClient = useQueryClient()

  // State for filters
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange)
  const [dataType, setDataType] = useState<DataType>(initialDataType)
  const [startDate, setStartDate] = useState<string | null>(initialStartDate || null)
  const [endDate, setEndDate] = useState<string | null>(initialEndDate || null)
  const [detailedView, setDetailedView] = useState<boolean>(detailed)
  const [refreshInterval, setRefreshInterval] = useState<number>(autoRefreshInterval)

  // State for health checks
  const [pineconeApiHealthy, setPineconeApiHealthy] = useState<boolean | null>(null)
  const [openaiApiHealthy, setOpenaiApiHealthy] = useState<boolean | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false)
  const [healthErrors, setHealthErrors] = useState<{
    pinecone?: string | null
    openai?: string | null
  }>({})

  // Generate query key based on filters
  const analyticsQueryKey = useMemo(
    () => ["analytics", userId, timeRange, dataType, startDate, endDate, detailedView],
    [userId, timeRange, dataType, startDate, endDate, detailedView],
  )

  // Fetch analytics data with React Query
  const {
    data: analyticsData,
    isLoading,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: analyticsQueryKey,
    queryFn: async () => {
      const params: Record<string, string> = {
        userId,
        timeRange,
        type: dataType,
        detailed: detailedView.toString(),
      }

      // Add date range for custom time range
      if (timeRange === "custom") {
        if (!startDate || !endDate) {
          throw new Error("Start date and end date are required for custom time range")
        }
        params.startDate = startDate
        params.endDate = endDate
      }

      return fetchAnalytics(params)
    },
    refetchInterval: refreshInterval > 0 ? refreshInterval : undefined,
    staleTime: 60 * 1000, // 1 minute
    retry: 2,
    refetchOnWindowFocus: false,
  })

  /**
   * Set custom date range for analytics
   */
  const setDateRange = useCallback((start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
    setTimeRange("custom")
  }, [])

  /**
   * Set auto-refresh interval
   */
  const setAutoRefreshInterval = useCallback((interval: number) => {
    setRefreshInterval(interval)
  }, [])

  /**
   * Manually refresh analytics data
   */
  const refreshAnalytics = useCallback(async () => {
    await refetch()
  }, [refetch])

  /**
   * Check health of backend services
   */
  const checkHealth = useCallback(async () => {
    try {
      setIsCheckingHealth(true)
      setPineconeApiHealthy(null)
      setOpenaiApiHealthy(null)

      const health = await checkApiHealth()

      setPineconeApiHealthy(health.pineconeApiHealthy)
      setOpenaiApiHealthy(health.openaiApiHealthy)
      setHealthErrors(health.errors || {})

      // If there are errors, log them for debugging
      if (health.errors?.pinecone) {
        console.error("Pinecone health check error:", health.errors.pinecone)
      }
      if (health.errors?.openai) {
        console.error("OpenAI health check error:", health.errors.openai)
      }
    } catch (err) {
      console.error("Error checking API health:", err)
      setPineconeApiHealthy(false)
      setOpenaiApiHealthy(false)
    } finally {
      setIsCheckingHealth(false)
    }
  }, [])

  /**
   * Transform time series data for charts
   */
  const transformTimeSeriesData = useCallback((data: TimeSeriesData[] | undefined): ChartData => {
    if (!data || data.length === 0) {
      return { labels: [], datasets: [{ data: [] }] }
    }

    // Sort by date
    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date))

    // Extract labels and values
    const labels = sortedData.map((item) => formatDateLabel(item.date))
    const values = sortedData.map((item) => item.value)

    return {
      labels,
      datasets: [
        {
          data: values,
        },
      ],
    }
  }, [])

  /**
   * Format date label based on time range
   */
  const formatDateLabel = useCallback(
    (dateString: string): string => {
      const date = new Date(dateString)

      switch (timeRange) {
        case "day":
          return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        case "week":
          return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
        case "month":
        case "custom":
          return date.toLocaleDateString([], { month: "short", day: "numeric" })
        default:
          return date.toLocaleDateString()
      }
    },
    [timeRange],
  )

  /**
   * Transform analytics data into chart-ready format
   */
  const chartData = useMemo(() => {
    if (!analyticsData) {
      return {
        documents: { labels: [], datasets: [{ data: [] }] },
        search: { labels: [], datasets: [{ data: [] }] },
        chat: { labels: [], datasets: [{ data: [] }] },
        system: { labels: [], datasets: [{ data: [] }] },
      }
    }

    return {
      documents: transformTimeSeriesData(analyticsData.documents.byDate),
      search: transformTimeSeriesData(analyticsData.search.byDate),
      chat: transformTimeSeriesData(analyticsData.chat.byDate),
      system: {
        labels: ["Documents", "Chunks", "Searches", "Messages"],
        datasets: [
          {
            data: [
              analyticsData.documents.total,
              analyticsData.documents.chunkCount,
              analyticsData.search.totalQueries,
              analyticsData.chat.totalMessages,
            ],
          },
        ],
      },
    }
  }, [analyticsData, transformTimeSeriesData])

  /**
   * Export analytics data in the specified format
   */
  const exportData = useCallback(
    (format: ExportFormat) => {
      if (!analyticsData) {
        console.error("No analytics data to export")
        return
      }

      try {
        let exportContent: string
        let fileName: string
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-")

        if (format === "json") {
          // Export as JSON
          exportContent = JSON.stringify(analyticsData, null, 2)
          fileName = `analytics-export-${timestamp}.json`
          downloadFile(exportContent, fileName, "application/json")
        } else if (format === "csv") {
          // Export as CSV
          const csvData = convertAnalyticsToCSV(analyticsData)
          fileName = `analytics-export-${timestamp}.csv`
          downloadFile(csvData, fileName, "text/csv")
        }
      } catch (err) {
        console.error("Error exporting analytics data:", err)
      }
    },
    [analyticsData],
  )

  /**
   * Convert analytics data to CSV format
   */
  const convertAnalyticsToCSV = (data: AnalyticsData): string => {
    // Create CSV sections for each data type
    const sections: string[] = []

    // Documents section
    sections.push("# Document Analytics")
    sections.push("Total Documents," + data.documents.total)
    sections.push("Total Chunks," + data.documents.chunkCount)
    sections.push("Average Chunks Per Document," + data.documents.averageChunksPerDocument.toFixed(2))
    sections.push("")

    sections.push("# Document Status")
    sections.push("Status,Count")
    Object.entries(data.documents.byStatus).forEach(([status, count]) => {
      sections.push(`${status},${count}`)
    })
    sections.push("")

    sections.push("# Document Timeline")
    sections.push("Date,Count")
    data.documents.byDate.forEach((item) => {
      sections.push(`${item.date},${item.value}`)
    })
    sections.push("")

    // Search section
    sections.push("# Search Analytics")
    sections.push("Total Queries," + data.search.totalQueries)
    sections.push("Average Results," + data.search.averageResults.toFixed(2))
    sections.push("")

    sections.push("# Popular Search Terms")
    sections.push("Term,Count")
    data.search.popularTerms.forEach((item) => {
      sections.push(`"${item.term}",${item.count}`)
    })
    sections.push("")

    sections.push("# Search Timeline")
    sections.push("Date,Count")
    data.search.byDate.forEach((item) => {
      sections.push(`${item.date},${item.value}`)
    })
    sections.push("")

    // Chat section
    sections.push("# Chat Analytics")
    sections.push("Total Conversations," + data.chat.totalConversations)
    sections.push("Total Messages," + data.chat.totalMessages)
    sections.push("Average Conversation Length," + data.chat.averageLength.toFixed(2))
    sections.push("")

    sections.push("# Message Distribution")
    sections.push("Role,Count")
    sections.push(`User,${data.chat.messageDistribution.user}`)
    sections.push(`Assistant,${data.chat.messageDistribution.assistant}`)
    sections.push("")

    sections.push("# Chat Timeline")
    sections.push("Date,Count")
    data.chat.byDate.forEach((item) => {
      sections.push(`${item.date},${item.value}`)
    })

    return sections.join("\n")
  }

  /**
   * Download a file with the specified content
   */
  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Return the hook interface
  return {
    // Data
    analytics: analyticsData || null,
    chartData,

    // State
    isLoading,
    error: error as Error | null,
    isFetching,
    dataTimestamp: dataUpdatedAt ? new Date(dataUpdatedAt) : null,

    // Filters
    timeRange,
    dataType,
    startDate,
    endDate,
    detailed: detailedView,

    // Actions
    refreshAnalytics,
    setTimeRange,
    setDataType,
    setDateRange,
    setAutoRefreshInterval,
    exportData,

    // Health checks
    pineconeApiHealthy,
    openaiApiHealthy,
    isCheckingHealth,
    healthErrors,
    checkHealth,
  }
}

/**
 * Add types to the global types file if they don't exist
 */
declare module "@/types" {
  export interface TimeSeriesData {
    date: string
    value: number
  }

  export interface ChartData {
    labels: string[]
    datasets: Array<{
      data: number[]
      [key: string]: any
    }>
  }

  export interface AnalyticsData {
    documents: {
      total: number
      byStatus: Record<string, number>
      byDate: TimeSeriesData[]
      processingTimes: {
        average: number
        min: number
        max: number
      }
      topDocuments: Array<{
        id: string
        name: string
        chunkCount: number
        createdAt: string
      }>
      chunkCount: number
      averageChunksPerDocument: number
    }
    search: {
      totalQueries: number
      popularTerms: Array<{
        term: string
        count: number
      }>
      averageResults: number
      byDate: TimeSeriesData[]
      resultDistribution: {
        noResults: number
        lowResults: number
        mediumResults: number
        highResults: number
      }
    }
    chat: {
      totalConversations: number
      totalMessages: number
      byDate: TimeSeriesData[]
      averageLength: number
      messageDistribution: {
        user: number
        assistant: number
      }
      topConversations: Array<{
        id: string
        messageCount: number
        lastActive: string
      }>
    }
    system: {
      vectorCount: number
      embeddingRequests: number
      apiCalls: {
        total: number
        byEndpoint: Record<string, number>
      }
      indexStats: {
        totalVectorCount: number
        namespaceCount: number
        indexFullness: number
      }
    }
    mightBeTruncated: {
      documents: boolean
      chunks: boolean
      searches: boolean
      chats: boolean
    }
  }
}
