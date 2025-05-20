/**
 * Analytics Widget Component
 *
 * A dashboard widget for displaying key metrics and analytics data.
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 * - @/hooks/use-analytics for analytics data
 */

"use client"

import { useEffect, useState } from "react"
import {
  FileText,
  Search,
  MessageSquare,
  Database,
  AlertCircle,
  Info,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useAnalytics } from "@/hooks/use-analytics"
import { useToast } from "@/components/toast"

interface AnalyticsWidgetProps {
  userId: string
}

// Maximum number of vectors per query
const MAX_VECTORS_PER_QUERY = 10000

export function AnalyticsWidget({ userId }: AnalyticsWidgetProps) {
  const {
    analytics,
    isLoading,
    error,
    refreshAnalytics,
    pineconeApiHealthy,
    openaiApiHealthy,
    isCheckingHealth,
    healthErrors,
  } = useAnalytics(userId)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [showPineconeError, setShowPineconeError] = useState(false)
  const [showOpenAIError, setShowOpenAIError] = useState(false)
  const { addToast } = useToast()

  // Check if we're in debug mode
  const isDebugMode = typeof window !== "undefined" && window.location.search.includes("debug=true")

  // Handle API errors
  useEffect(() => {
    if (error) {
      console.error("Analytics widget error:", error)
      setErrorMessage(error instanceof Error ? error.message : String(error))
      addToast("Failed to load analytics: " + (error instanceof Error ? error.message : "Unknown error"), "error")
    } else {
      setErrorMessage(null)
    }
  }, [error, addToast])

  // Retry loading analytics if there was an error
  const handleRetry = () => {
    setErrorMessage(null)
    refreshAnalytics()
  }

  // Default values if data is not available
  const metrics = {
    documentCount: analytics?.documentCount || 0,
    searchCount: analytics?.searchCount || 0,
    chatCount: analytics?.chatCount || 0,
    chunkCount: analytics?.chunkCount || 0,
  }

  // Check if any count might be truncated
  const mightBeTruncated = analytics?.mightBeTruncated || {
    documents: metrics.documentCount >= MAX_VECTORS_PER_QUERY,
    chunks: metrics.chunkCount >= MAX_VECTORS_PER_QUERY,
    searches: metrics.searchCount >= MAX_VECTORS_PER_QUERY,
    chats: metrics.chatCount >= MAX_VECTORS_PER_QUERY,
  }

  return (
    <DashboardCard title="Analytics" description="Key metrics and usage statistics" isLoading={isLoading}>
      <div className="space-y-4">
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={handleRetry} className="mt-2 text-sm text-red-700 hover:text-red-900 underline">
              Retry
            </button>
          </div>
        )}

        {/* API Health Status */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div
            className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
              pineconeApiHealthy
                ? "bg-green-100 text-green-800"
                : pineconeApiHealthy === false
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
            }`}
            onClick={() => healthErrors?.pinecone && setShowPineconeError(!showPineconeError)}
            style={{ cursor: healthErrors?.pinecone ? "pointer" : "default" }}
          >
            {pineconeApiHealthy === null ? (
              <span className="animate-pulse">Checking Pinecone...</span>
            ) : pineconeApiHealthy ? (
              <>
                <Check className="h-4 w-4" />
                <span>Pinecone API</span>
              </>
            ) : (
              <>
                <X className="h-4 w-4" />
                <span>Pinecone API</span>
                {healthErrors?.pinecone && <HelpCircle className="h-3 w-3 ml-1" />}
              </>
            )}
          </div>

          <div
            className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
              openaiApiHealthy
                ? "bg-green-100 text-green-800"
                : openaiApiHealthy === false
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
            }`}
            onClick={() => healthErrors?.openai && setShowOpenAIError(!showOpenAIError)}
            style={{ cursor: healthErrors?.openai ? "pointer" : "default" }}
          >
            {openaiApiHealthy === null ? (
              <span className="animate-pulse">Checking OpenAI...</span>
            ) : openaiApiHealthy ? (
              <>
                <Check className="h-4 w-4" />
                <span>OpenAI API</span>
              </>
            ) : (
              <>
                <X className="h-4 w-4" />
                <span>OpenAI API</span>
                {healthErrors?.openai && <HelpCircle className="h-3 w-3 ml-1" />}
              </>
            )}
          </div>

          {isCheckingHealth && (
            <button
              onClick={refreshAnalytics}
              className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 flex items-center gap-1"
              disabled={isCheckingHealth}
            >
              <span className="animate-pulse">Checking APIs...</span>
            </button>
          )}

          {!isCheckingHealth && (
            <button
              onClick={refreshAnalytics}
              className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 flex items-center gap-1"
            >
              <span>Refresh</span>
            </button>
          )}
        </div>

        {/* Error Details */}
        {showPineconeError && healthErrors?.pinecone && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
              <div>
                <h4 className="font-medium">Pinecone API Error</h4>
                <p className="text-sm mt-1">{healthErrors.pinecone}</p>
                <p className="text-xs mt-2">
                  Check that your PINECONE_HOST is set correctly to the exact host URL from the Pinecone console.
                </p>
              </div>
            </div>
          </div>
        )}

        {showOpenAIError && healthErrors?.openai && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
              <div>
                <h4 className="font-medium">OpenAI API Error</h4>
                <p className="text-sm mt-1">{healthErrors.openai}</p>
              </div>
            </div>
          </div>
        )}

        {(mightBeTruncated.documents ||
          mightBeTruncated.chunks ||
          mightBeTruncated.searches ||
          mightBeTruncated.chats) && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md mb-4">
            <div className="flex items-center">
              <Info className="h-5 w-5 mr-2" />
              <span>Some counts may be truncated due to large data volume.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 rounded-md bg-blue-100">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Documents</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.documentCount}
              {mightBeTruncated.documents && "+"}
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 rounded-md bg-green-100">
                <Search className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Searches</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.searchCount}
              {mightBeTruncated.searches && "+"}
            </p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 rounded-md bg-purple-100">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Chats</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.chatCount}
              {mightBeTruncated.chats && "+"}
            </p>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="p-2 rounded-md bg-amber-100">
                <Database className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Chunks</p>
            <p className="text-2xl font-semibold text-gray-900">
              {metrics.chunkCount}
              {mightBeTruncated.chunks && "+"}
            </p>
          </div>
        </div>

        {/* Debug Panel */}
        {isDebugMode && (
          <div className="mt-6">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              {showDebug ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showDebug ? "Hide Debug Info" : "Show Debug Info"}
            </button>

            {showDebug && (
              <div className="mt-2 p-4 bg-gray-50 rounded-md overflow-auto max-h-96">
                <h4 className="font-medium mb-2">Analytics Data</h4>
                <pre className="text-xs mb-4">{JSON.stringify(analytics, null, 2)}</pre>

                <h4 className="font-medium mb-2">Health Status</h4>
                <pre className="text-xs mb-4">
                  {JSON.stringify(
                    {
                      pineconeApiHealthy,
                      openaiApiHealthy,
                      healthErrors,
                    },
                    null,
                    2,
                  )}
                </pre>

                <h4 className="font-medium mb-2">Environment Variables (Safe)</h4>
                <pre className="text-xs">
                  {JSON.stringify(
                    {
                      PINECONE_HOST_SET: !!process.env.PINECONE_HOST,
                      PINECONE_API_KEY_SET: !!process.env.PINECONE_API_KEY,
                      PINECONE_INDEX_NAME_SET: !!process.env.PINECONE_INDEX_NAME,
                      OPENAI_API_KEY_SET: !!process.env.OPENAI_API_KEY,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardCard>
  )
}
