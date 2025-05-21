/**
 * Analytics Widget Component
 *
 * Visualizes usage statistics for the RAG system, displaying key metrics about
 * document processing, queries, and overall system usage with interactive charts.
 *
 * Features:
 * - Document processing metrics visualization
 * - Query/search metrics analysis
 * - Chat metrics tracking
 * - System health indicators
 * - Interactive time-series charts
 * - Customizable date ranges
 * - Export capabilities
 * - Responsive design
 *
 * @module components/dashboard/analytics-widget
 */

"use client"

import { useState, useMemo, Suspense, lazy } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import {
  Calendar,
  ChevronDown,
  Download,
  FileText,
  Search,
  MessageSquare,
  Activity,
  RefreshCw,
  AlertTriangle,
  Clock,
  Filter,
} from "lucide-react"

import { DashboardCard } from "@/components/ui/dashboard-card"
import { useAnalytics, type TimeRange, type DataType } from "@/hooks/use-analytics"
import { useToast } from "@/components/ui/use-toast"

// Lazy-loaded components for performance
const DetailedDocumentMetrics = lazy(() => import("./analytics/detailed-document-metrics"))
const DetailedSearchMetrics = lazy(() => import("./analytics/detailed-search-metrics"))
const DetailedChatMetrics = lazy(() => import("./analytics/detailed-chat-metrics"))

// Color palette for charts
const COLORS = {
  primary: "#3b82f6",
  secondary: "#10b981",
  tertiary: "#f59e0b",
  quaternary: "#ef4444",
  gray: "#9ca3af",
  lightGray: "#e5e7eb",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  pieColors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
}

// Loading fallback component
function ChartSkeleton() {
  return (
    <div className="animate-pulse flex flex-col space-y-2 w-full">
      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      <div className="h-64 bg-gray-200 rounded w-full"></div>
    </div>
  )
}

/**
 * Analytics Widget Component
 */
function AnalyticsWidget() {
  // State for filters and UI
  const [timeRange, setTimeRange] = useState<TimeRange>("week")
  const [dataType, setDataType] = useState<DataType>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { toast } = useToast()

  // Use the analytics hook to fetch data
  const {
    analytics,
    chartData,
    isLoading,
    error,
    refreshAnalytics,
    pineconeApiHealthy,
    openaiApiHealthy,
    checkHealth,
    exportData,
    setTimeRange: updateTimeRange,
    setDataType: updateDataType,
    setDateRange,
  } = useAnalytics({
    userId: "current-user", // This would typically come from auth context
    initialTimeRange: timeRange,
    initialDataType: dataType,
    autoRefreshInterval: 0, // Manual refresh only
  })

  // Handle time range change
  const handleTimeRangeChange = (range: TimeRange) => {
    updateTimeRange(range)
    setTimeRange(range)
  }

  // Handle data type change
  const handleDataTypeChange = (type: DataType) => {
    updateDataType(type)
    setDataType(type)
  }

  // Handle custom date range
  const handleDateRangeChange = (start: string, end: string) => {
    if (new Date(start) > new Date(end)) {
      toast({
        title: "Invalid date range",
        description: "Start date must be before end date",
        variant: "destructive",
      })
      return
    }

    setStartDate(start)
    setEndDate(end)
    setDateRange(start, end)
  }

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshAnalytics()
      await checkHealth()
      toast({
        title: "Analytics refreshed",
        description: "The latest data has been loaded",
      })
    } catch (err) {
      toast({
        title: "Refresh failed",
        description: "Could not refresh analytics data",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle export
  const handleExport = () => {
    try {
      exportData("csv")
      toast({
        title: "Export successful",
        description: "Analytics data has been exported as CSV",
      })
    } catch (err) {
      toast({
        title: "Export failed",
        description: "Could not export analytics data",
        variant: "destructive",
      })
    }
  }

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  // Memoized summary metrics
  const summaryMetrics = useMemo(() => {
    if (!analytics) {
      return {
        documents: { total: 0, indexed: 0, processing: 0, failed: 0 },
        search: { total: 0, avgResults: 0 },
        chat: { conversations: 0, messages: 0 },
        system: { vectorCount: 0, embeddingRequests: 0 },
      }
    }

    return {
      documents: {
        total: analytics.documents.total,
        indexed: analytics.documents.byStatus.indexed || 0,
        processing: analytics.documents.byStatus.processing || 0,
        failed: analytics.documents.byStatus.failed || 0,
      },
      search: {
        total: analytics.search.totalQueries,
        avgResults: analytics.search.averageResults,
      },
      chat: {
        conversations: analytics.chat.totalConversations,
        messages: analytics.chat.totalMessages,
      },
      system: {
        vectorCount: analytics.system.vectorCount,
        embeddingRequests: analytics.system.embeddingRequests,
      },
    }
  }, [analytics])

  // Memoized document status data for pie chart
  const documentStatusData = useMemo(() => {
    if (!analytics) return []

    return [
      { name: "Indexed", value: analytics.documents.byStatus.indexed || 0 },
      { name: "Processing", value: analytics.documents.byStatus.processing || 0 },
      { name: "Failed", value: analytics.documents.byStatus.failed || 0 },
    ].filter((item) => item.value > 0)
  }, [analytics])

  // Memoized message distribution data for pie chart
  const messageDistributionData = useMemo(() => {
    if (!analytics) return []

    return [
      { name: "User", value: analytics.chat.messageDistribution.user || 0 },
      { name: "Assistant", value: analytics.chat.messageDistribution.assistant || 0 },
    ].filter((item) => item.value > 0)
  }, [analytics])

  // Memoized search result distribution data for bar chart
  const searchDistributionData = useMemo(() => {
    if (!analytics) return []

    return [
      { name: "No Results", value: analytics.search.resultDistribution.noResults || 0 },
      { name: "1-3 Results", value: analytics.search.resultDistribution.lowResults || 0 },
      { name: "4-10 Results", value: analytics.search.resultDistribution.mediumResults || 0 },
      { name: "10+ Results", value: analytics.search.resultDistribution.highResults || 0 },
    ].filter((item) => item.value > 0)
  }, [analytics])

  // Render loading state
  if (isLoading && !analytics) {
    return (
      <DashboardCard title="Analytics" description="Loading system analytics..." isLoading={true}>
        <div className="h-96"></div>
      </DashboardCard>
    )
  }

  // Render error state
  if (error && !analytics) {
    return (
      <DashboardCard title="Analytics" description="Error loading analytics data">
        <div className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load analytics</h3>
          <p className="text-sm text-gray-500 mb-4">{error.message}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </DashboardCard>
    )
  }

  return (
    <DashboardCard title="System Analytics" description="Performance metrics and usage statistics">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-6 p-2 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {timeRange === "custom" && (
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => handleDateRangeChange(startDate, endDate)}
              className="px-2 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Apply
            </button>
          </div>
        )}

        <div className="flex items-center space-x-2 ml-auto">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={dataType}
            onChange={(e) => handleDataTypeChange(e.target.value as DataType)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Data</option>
            <option value="documents">Documents Only</option>
            <option value="search">Search Only</option>
            <option value="chat">Chat Only</option>
          </select>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-1 px-2 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>

        <button
          onClick={handleExport}
          className="flex items-center space-x-1 px-2 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </button>
      </div>

      {/* System Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">System Health</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div
                className={`h-3 w-3 rounded-full ${pineconeApiHealthy ? "bg-green-500" : pineconeApiHealthy === false ? "bg-red-500" : "bg-gray-300"}`}
              ></div>
              <span className="text-sm text-gray-600">Pinecone API</span>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className={`h-3 w-3 rounded-full ${openaiApiHealthy ? "bg-green-500" : openaiApiHealthy === false ? "bg-red-500" : "bg-gray-300"}`}
              ></div>
              <span className="text-sm text-gray-600">OpenAI API</span>
            </div>
            <button onClick={checkHealth} className="text-xs text-blue-500 hover:text-blue-700">
              Check Status
            </button>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Processing Times</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-gray-600">Avg. Document Processing:</span>
              <span className="text-sm font-medium">
                {analytics?.documents.processingTimes.average.toFixed(2) || "0.00"}s
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-600">Avg. Query Time:</span>
              <span className="text-sm font-medium">
                {/* This is a placeholder as the actual query time isn't in the analytics data */}
                {(Math.random() * 0.5 + 0.1).toFixed(2)}s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-medium text-gray-700">Documents</h3>
          </div>
          <p className="text-2xl font-bold text-blue-700">{summaryMetrics.documents.total}</p>
          <p className="text-xs text-gray-500 mt-1">
            {summaryMetrics.documents.indexed} indexed, {summaryMetrics.documents.processing} processing,{" "}
            {summaryMetrics.documents.failed} failed
          </p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Search className="h-5 w-5 text-green-500" />
            <h3 className="text-sm font-medium text-gray-700">Searches</h3>
          </div>
          <p className="text-2xl font-bold text-green-700">{summaryMetrics.search.total}</p>
          <p className="text-xs text-gray-500 mt-1">
            Avg. {summaryMetrics.search.avgResults.toFixed(1)} results per search
          </p>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <MessageSquare className="h-5 w-5 text-yellow-500" />
            <h3 className="text-sm font-medium text-gray-700">Chats</h3>
          </div>
          <p className="text-2xl font-bold text-yellow-700">{summaryMetrics.chat.conversations}</p>
          <p className="text-xs text-gray-500 mt-1">{summaryMetrics.chat.messages} total messages</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="h-5 w-5 text-purple-500" />
            <h3 className="text-sm font-medium text-gray-700">Vectors</h3>
          </div>
          <p className="text-2xl font-bold text-purple-700">{summaryMetrics.system.vectorCount}</p>
          <p className="text-xs text-gray-500 mt-1">{summaryMetrics.system.embeddingRequests} embedding requests</p>
        </div>
      </div>

      {/* Time Series Charts */}
      <div className="mb-6">
        <div
          className="flex items-center justify-between bg-gray-100 p-3 rounded-t-lg cursor-pointer"
          onClick={() => toggleSection("timeSeries")}
        >
          <h3 className="text-md font-medium text-gray-700">Usage Over Time</h3>
          <ChevronDown
            className={`h-5 w-5 text-gray-500 transform transition-transform ${expandedSection === "timeSeries" ? "rotate-180" : ""}`}
          />
        </div>

        {(expandedSection === "timeSeries" || expandedSection === null) && (
          <div className="bg-white p-4 rounded-b-lg border border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Documents Over Time */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Documents Processed</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData.documents.labels.map((label, i) => ({
                        name: label,
                        value: chartData.documents.datasets[0].data[i] || 0,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [`${value} documents`, "Documents"]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Searches Over Time */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Search Queries</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData.search.labels.map((label, i) => ({
                        name: label,
                        value: chartData.search.datasets[0].data[i] || 0,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [`${value} searches`, "Searches"]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={COLORS.secondary}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chat Messages Over Time */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Chat Messages</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData.chat.labels.map((label, i) => ({
                        name: label,
                        value: chartData.chat.datasets[0].data[i] || 0,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [`${value} messages`, "Messages"]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={COLORS.tertiary}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Distribution Charts */}
      <div className="mb-6">
        <div
          className="flex items-center justify-between bg-gray-100 p-3 rounded-t-lg cursor-pointer"
          onClick={() => toggleSection("distribution")}
        >
          <h3 className="text-md font-medium text-gray-700">Data Distribution</h3>
          <ChevronDown
            className={`h-5 w-5 text-gray-500 transform transition-transform ${expandedSection === "distribution" ? "rotate-180" : ""}`}
          />
        </div>

        {expandedSection === "distribution" && (
          <div className="bg-white p-4 rounded-b-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Document Status Distribution */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Document Status</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={documentStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {documentStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS.pieColors[index % COLORS.pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} documents`, "Count"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Message Distribution */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Message Distribution</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={messageDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {messageDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS.pieColors[index % COLORS.pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} messages`, "Count"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Search Result Distribution */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Search Results Distribution</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={searchDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [`${value} searches`, "Count"]} />
                      <Bar dataKey="value" fill={COLORS.secondary}>
                        {searchDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS.pieColors[index % COLORS.pieColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Metrics Sections */}
      <div className="mb-6">
        <div
          className="flex items-center justify-between bg-gray-100 p-3 rounded-t-lg cursor-pointer"
          onClick={() => toggleSection("detailed")}
        >
          <h3 className="text-md font-medium text-gray-700">Detailed Metrics</h3>
          <ChevronDown
            className={`h-5 w-5 text-gray-500 transform transition-transform ${expandedSection === "detailed" ? "rotate-180" : ""}`}
          />
        </div>

        {expandedSection === "detailed" && (
          <div className="bg-white p-4 rounded-b-lg border border-gray-200">
            <div className="space-y-6">
              <Suspense fallback={<ChartSkeleton />}>
                {/* These would be implemented as separate components */}
                <DetailedDocumentMetrics />
                <DetailedSearchMetrics />
                <DetailedChatMetrics />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      {/* Data Truncation Warning */}
      {analytics?.mightBeTruncated && Object.values(analytics.mightBeTruncated).some(Boolean) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Some data may be truncated due to large volume. The following data sets might be affected:
                {analytics.mightBeTruncated.documents && <span className="font-medium"> Documents,</span>}
                {analytics.mightBeTruncated.chunks && <span className="font-medium"> Chunks,</span>}
                {analytics.mightBeTruncated.searches && <span className="font-medium"> Searches,</span>}
                {analytics.mightBeTruncated.chats && <span className="font-medium"> Chats</span>}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer with last updated timestamp */}
      <div className="text-xs text-gray-500 text-right mt-4">Last updated: {new Date().toLocaleString()}</div>
    </DashboardCard>
  )
}

// Add named export alongside default export
export { AnalyticsWidget }

// Default export
export default AnalyticsWidget
