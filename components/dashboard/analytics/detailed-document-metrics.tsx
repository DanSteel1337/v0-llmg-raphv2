"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { FileText } from "lucide-react"

// Sample data - in a real app, this would come from your analytics hook
const documentData = [
  { name: "PDF", count: 45 },
  { name: "TXT", count: 32 },
  { name: "DOCX", count: 18 },
  { name: "HTML", count: 12 },
  { name: "Other", count: 5 },
]

const processingTimeData = [
  { name: "< 1s", count: 10 },
  { name: "1-5s", count: 35 },
  { name: "5-10s", count: 25 },
  { name: "10-30s", count: 15 },
  { name: "> 30s", count: 5 },
]

export default function DetailedDocumentMetrics() {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex items-center space-x-2 mb-4">
        <FileText className="h-5 w-5 text-blue-500" />
        <h3 className="text-md font-medium text-gray-700">Detailed Document Metrics</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Documents by Type</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={documentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} documents`, "Count"]} />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Processing Time Distribution</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processingTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} documents`, "Count"]} />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
