"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { MessageSquare } from "lucide-react"

// Sample data - in a real app, this would come from your analytics hook
const messageCountData = [
  { name: "1-5", count: 30 },
  { name: "6-10", count: 25 },
  { name: "11-20", count: 15 },
  { name: "21-50", count: 8 },
  { name: "> 50", count: 2 },
]

const responseTimeData = [
  { name: "< 1s", count: 10 },
  { name: "1-2s", count: 35 },
  { name: "2-5s", count: 30 },
  { name: "5-10s", count: 15 },
  { name: "> 10s", count: 5 },
]

export default function DetailedChatMetrics() {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex items-center space-x-2 mb-4">
        <MessageSquare className="h-5 w-5 text-yellow-500" />
        <h3 className="text-md font-medium text-gray-700">Detailed Chat Metrics</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Messages per Conversation</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={messageCountData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} conversations`, "Count"]} />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Response Time Distribution</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} responses`, "Count"]} />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
