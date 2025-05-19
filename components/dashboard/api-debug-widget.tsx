/**
 * API Debug Widget Component
 *
 * A dashboard widget for testing API endpoints directly from the UI.
 * Allows developers to make requests to different endpoints and see responses.
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 * - @/components/toast for notifications
 */

"use client"

import { useState } from "react"
import { Code, Play, ChevronDown, ChevronUp, Copy, Check, Key, Cpu } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useToast } from "@/components/toast"

interface ApiDebugWidgetProps {
  userId: string
}

type ApiEndpoint = {
  name: string
  method: "GET" | "POST" | "DELETE"
  path: string
  description: string
  requiresBody?: boolean
  defaultBody?: string
  requiresParams?: boolean
  defaultParams?: string
}

export function ApiDebugWidget({ userId }: ApiDebugWidgetProps) {
  const { addToast } = useToast()
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null)
  const [requestBody, setRequestBody] = useState("")
  const [queryParams, setQueryParams] = useState("")
  const [response, setResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState(false)

  // Define available API endpoints
  const apiEndpoints: ApiEndpoint[] = [
    {
      name: "Get Documents",
      method: "GET",
      path: "/api/documents",
      description: "Fetch all documents for the current user",
      requiresParams: true,
      defaultParams: `userId=${userId}`,
    },
    {
      name: "Get Conversations",
      method: "GET",
      path: "/api/conversations",
      description: "Fetch all conversations for the current user",
      requiresParams: true,
      defaultParams: `userId=${userId}`,
    },
    {
      name: "Get Analytics",
      method: "GET",
      path: "/api/analytics",
      description: "Fetch analytics data for the current user",
      requiresParams: true,
      defaultParams: `userId=${userId}`,
    },
    {
      name: "Create Document",
      method: "POST",
      path: "/api/documents",
      description: "Create a new document",
      requiresBody: true,
      defaultBody: JSON.stringify(
        {
          userId,
          name: "Test Document",
          description: "Created via API Debug",
          fileType: "text/plain",
          fileSize: 1024,
          filePath: "test/path.txt",
        },
        null,
        2,
      ),
    },
    {
      name: "Process Document",
      method: "POST",
      path: "/api/documents/process",
      description: "Process an existing document",
      requiresBody: true,
      defaultBody: JSON.stringify(
        {
          documentId: "[DOCUMENT_ID]",
          userId,
          filePath: "test/path.txt",
          fileName: "Test Document",
          fileType: "text/plain",
          fileUrl: "https://example.com/files/test.txt",
        },
        null,
        2,
      ),
    },
    {
      name: "Create Conversation",
      method: "POST",
      path: "/api/conversations",
      description: "Create a new conversation",
      requiresBody: true,
      defaultBody: JSON.stringify(
        {
          userId,
          title: "Test Conversation",
        },
        null,
        2,
      ),
    },
    {
      name: "Search",
      method: "GET",
      path: "/api/search",
      description: "Search documents",
      requiresParams: true,
      defaultParams: `userId=${userId}&q=test&type=semantic`,
    },
    {
      name: "Generate Embedding",
      method: "POST",
      path: "/api/embeddings",
      description: "Generate an embedding using text-embedding-3-large",
      requiresBody: true,
      defaultBody: JSON.stringify(
        {
          text: "This is a test document to generate an embedding vector.",
        },
        null,
        2,
      ),
    },
    {
      name: "Send Message",
      method: "POST",
      path: "/api/chat/messages",
      description: "Send a chat message",
      requiresBody: true,
      defaultBody: JSON.stringify(
        {
          conversationId: "[CONVERSATION_ID]",
          content: "Hello, this is a test message",
          userId,
        },
        null,
        2,
      ),
    },
  ]

  // Handle endpoint selection
  const handleSelectEndpoint = (endpoint: ApiEndpoint) => {
    setSelectedEndpoint(endpoint)
    setRequestBody(endpoint.requiresBody ? endpoint.defaultBody || "" : "")
    setQueryParams(endpoint.requiresParams ? endpoint.defaultParams || "" : "")
    setResponse(null)
    setError(null)
  }

  // Execute API request
  const handleExecuteRequest = async () => {
    if (!selectedEndpoint) return

    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      let url = selectedEndpoint.path
      if (selectedEndpoint.requiresParams && queryParams) {
        url = `${url}?${queryParams}`
      }

      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          "Content-Type": "application/json",
        },
      }

      if (selectedEndpoint.requiresBody && requestBody) {
        options.body = requestBody
      }

      const startTime = Date.now()
      const response = await fetch(url, options)
      const duration = Date.now() - startTime

      if (response.status === 405) {
        throw new Error("Request failed: endpoint does not support this method.")
      }

      const data = await response.json()

      setResponse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        duration: `${duration}ms`,
      })

      if (!response.ok) {
        setError(`Request failed with status ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      console.error("API Debug error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Copy response to clipboard
  const handleCopyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      addToast("Response copied to clipboard", "success")
    }
  }

  // Check API keys
  const checkApiKeys = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Check Pinecone API key
      const pineconeResponse = await fetch("/api/debug/check-keys?service=pinecone")
      const pineconeData = await pineconeResponse.json()

      // Check OpenAI API key
      const openaiResponse = await fetch("/api/debug/check-keys?service=openai")
      const openaiData = await openaiResponse.json()

      setResponse({
        pinecone: pineconeData,
        openai: openaiData,
        timestamp: new Date().toISOString(),
      })

      if (!pineconeData.success || !openaiData.success) {
        setError("One or more API keys are invalid or missing. Check the response for details.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      console.error("API key check error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DashboardCard
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <Code className="h-5 w-5 mr-2" />
            API Debug
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      }
      description={isExpanded ? "Test API endpoints directly from the dashboard" : undefined}
    >
      {isExpanded && (
        <div className="space-y-4">
          <div className="flex justify-between">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Select an API endpoint</h3>
            <button
              onClick={() => setShowApiKeys(!showApiKeys)}
              className="flex items-center text-xs text-blue-600 hover:text-blue-800"
            >
              <Key className="h-3 w-3 mr-1" />
              {showApiKeys ? "Hide API Status" : "Check API Status"}
            </button>
          </div>

          {showApiKeys && (
            <div className="border border-gray-200 rounded-md p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-gray-700">API Keys Status</h3>
                <button
                  onClick={checkApiKeys}
                  disabled={isLoading}
                  className="flex items-center text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
                >
                  <Cpu className="h-3 w-3 mr-1" />
                  {isLoading ? "Checking..." : "Check Now"}
                </button>
              </div>
              <div className="text-xs text-gray-500">
                <p>
                  Current embedding model: <span className="font-mono">text-embedding-3-large</span>
                </p>
                <div className="flex space-x-4 mt-2">
                  <div className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-green-500 mr-1"></div>
                    <span>Pinecone API</span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-blue-500 mr-1"></div>
                    <span>OpenAI API</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-md p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {apiEndpoints.map((endpoint) => (
                <button
                  key={endpoint.name}
                  onClick={() => handleSelectEndpoint(endpoint)}
                  className={`text-left px-3 py-2 rounded-md text-sm ${
                    selectedEndpoint?.name === endpoint.name
                      ? "bg-blue-100 text-blue-700 border border-blue-300"
                      : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  <div className="font-medium">{endpoint.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium mr-2 ${
                        endpoint.method === "GET"
                          ? "bg-green-100 text-green-800"
                          : endpoint.method === "POST"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    {endpoint.path}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedEndpoint && (
            <>
              <div className="border border-gray-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {selectedEndpoint.name} - {selectedEndpoint.description}
                </h3>

                {selectedEndpoint.requiresParams && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Query Parameters</label>
                    <input
                      type="text"
                      value={queryParams}
                      onChange={(e) => setQueryParams(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm font-mono"
                      placeholder="param1=value1&param2=value2"
                    />
                  </div>
                )}

                {selectedEndpoint.requiresBody && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Request Body (JSON)</label>
                    <textarea
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm font-mono h-32"
                      placeholder="{}"
                    />
                  </div>
                )}

                <button
                  onClick={handleExecuteRequest}
                  disabled={isLoading}
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute Request
                    </>
                  )}
                </button>
              </div>

              {(response || error) && (
                <div className="border border-gray-200 rounded-md p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Response</h3>
                    {response && (
                      <div className="flex items-center">
                        {response.duration && (
                          <span className="text-xs text-gray-500 mr-3">Duration: {response.duration}</span>
                        )}
                        <button
                          onClick={handleCopyResponse}
                          className="flex items-center text-xs text-gray-500 hover:text-gray-700"
                        >
                          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm mb-3">
                      {error}
                    </div>
                  )}

                  {response && (
                    <div className="bg-gray-50 p-3 rounded-md overflow-auto max-h-96">
                      <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(response, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </DashboardCard>
  )
}
