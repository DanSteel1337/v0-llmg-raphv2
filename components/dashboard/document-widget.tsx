/**
 * Document Widget Component
 *
 * A dashboard widget for document management, showing recent documents
 * and providing quick upload functionality.
 *
 * Dependencies:
 * - @/hooks/use-documents for document data
 * - @/components/ui/dashboard-card for layout
 * - @/types for document types
 */

"use client"

import type React from "react"

import { useState, useRef } from "react"
import { FileText, Upload, AlertCircle, CheckCircle } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useDocuments } from "@/hooks/use-documents"
import { formatFileSize, formatDate } from "@/utils/formatting"
import { useToast } from "@/components/toast"
import type { Document } from "@/types"

interface DocumentWidgetProps {
  userId: string
  limit?: number
}

export function DocumentWidget({ userId, limit = 5 }: DocumentWidgetProps) {
  const { documents, isLoading, uploadDocument } = useDocuments(userId)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  const recentDocuments = documents.slice(0, limit)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      await uploadDocument(file)
      addToast("Document uploaded successfully", "success")
    } catch (error) {
      addToast("Failed to upload document", "error")
      console.error("Upload error:", error)
    } finally {
      setIsUploading(false)
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const getStatusIcon = (status: Document["status"]) => {
    switch (status) {
      case "indexed":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case "processing":
        return <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
      default:
        return null
    }
  }

  return (
    <DashboardCard title="Documents" description="Recently uploaded documents" isLoading={isLoading && !isUploading}>
      <div className="space-y-4">
        <button
          onClick={handleUploadClick}
          disabled={isUploading}
          className="w-full flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isUploading ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </>
          )}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.docx,.txt,.md"
        />

        {recentDocuments.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {recentDocuments.map((doc) => (
              <li key={doc.id} className="py-3 flex justify-between items-center">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">{getStatusIcon(doc.status)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No documents yet. Upload your first document to get started.
          </div>
        )}
      </div>
    </DashboardCard>
  )
}
