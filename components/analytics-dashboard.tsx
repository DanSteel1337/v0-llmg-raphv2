"use client"

import { useState } from "react"
import { Calendar, Download, RefreshCw, FileText, Search, MessageSquare, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useAnalytics } from "@/hooks/use-analytics"

interface AnalyticsDashboardProps {
  userId: string
}

// Sample data for charts
const documentTypeData = [
  { name: "PDF", value: 45 },
  { name: "DOCX", value: 30 },
  { name: "TXT", value: 15 },
  { name: "CSV", value: 5 },
  { name: "XLSX", value: 5 },
]

const userActivityData = [
  { date: "Mon", searches: 65, chats: 40 },
  { date: "Tue", searches: 80, chats: 55 },
  { date: "Wed", searches: 95, chats: 70 },
  { date: "Thu", searches: 85, chats: 60 },
  { date: "Fri", searches: 75, chats: 50 },
  { date: "Sat", searches: 45, chats: 30 },
  { date: "Sun", searches: 35, chats: 25 },
]

const performanceData = [
  { name: "Search Latency", value: 250 },
  { name: "Indexing Speed", value: 85 },
  { name: "Chat Response", value: 320 },
  { name: "Document Processing", value: 450 },
]

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

export function AnalyticsDashboard({ userId }: AnalyticsDashboardProps) {
  const { data, isLoading, error, timeRange, setTimeRange, fetchAnalytics } = useAnalytics(userId)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchAnalytics().finally(() => {
      setIsRefreshing(false)
    })
  }

  const handleExport = () => {
    // Simulate export functionality
    alert("Analytics data export started. You'll receive a download link shortly.")
  }

  // Use real data if available, otherwise use sample data
  const searchData = data?.searchUsage || [
    { date: "2023-01", count: 120 },
    { date: "2023-02", count: 150 },
    { date: "2023-03", count: 180 },
    { date: "2023-04", count: 220 },
    { date: "2023-05", count: 250 },
    { date: "2023-06", count: 280 },
    { date: "2023-07", count: 310 },
    { date: "2023-08", count: 340 },
    { date: "2023-09", count: 370 },
    { date: "2023-10", count: 400 },
    { date: "2023-11", count: 430 },
    { date: "2023-12", count: 460 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Monitor system usage, performance, and document statistics.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
              <SelectItem value="year">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.documentCount || 0}</div>
            <p className="text-xs text-muted-foreground">+24 from last {timeRange}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.searchCount || 0}</div>
            <p className="text-xs text-muted-foreground">+12% from last {timeRange}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chat Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.chatCount || 0}</div>
            <p className="text-xs text-muted-foreground">+18% from last {timeRange}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">320ms</div>
            <p className="text-xs text-muted-foreground">-15ms from last {timeRange}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Search Usage</CardTitle>
            <CardDescription>Number of searches over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                count: {
                  label: "Search Count",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={searchData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document Types</CardTitle>
            <CardDescription>Distribution of document formats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.documentTypes || documentTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(data?.documentTypes || documentTypeData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} documents`, "Count"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
            <CardDescription>Searches and chat interactions by day</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                searches: {
                  label: "Searches",
                  color: "hsl(var(--chart-1))",
                },
                chats: {
                  label: "Chat Messages",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.userActivity || userActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="searches" fill="var(--color-searches)" />
                  <Bar dataKey="chats" fill="var(--color-chats)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
            <CardDescription>Average response times in milliseconds</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                value: {
                  label: "Response Time (ms)",
                  color: "hsl(var(--chart-3))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={
                    data?.performance
                      ? Object.entries(data.performance).map(([name, value]) => ({ name, value }))
                      : performanceData
                  }
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
