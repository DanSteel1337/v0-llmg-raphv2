"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Search } from "lucide-react"

// Sample data - in a real app, this would come from your analytics hook
const searchLatencyData = [
  { name: "< 100ms", count: 25 },
  { name: "100-300ms", count: 40 },
  { name: "300-500ms", count: 20 },
  { name: "500ms-1s", count: 10 },
  { name: "> 1s", count: 5 },
]

const topSearchTermsData = [
  { name: "machine learning", count: 15 },
  { name: "vector database", count: 12 },
  { name: "embeddings", count: 10 },
  { name: "neural networks", count: 8 },
  { name: "transformers", count: 7 },
]

export default function DetailedSearchMetrics() {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex items-center space-x-2 mb-4">
        <Search className="h-5 w-5 text-green-500" />
        <h3 className="text-md font-medium text-gray-700">Detailed Search Metrics</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Search Latency Distribution</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={searchLatencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} searches`, "Count"]} />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Top Search Terms</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSearchTermsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value) => [`${value} searches`, "Count"]} />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
