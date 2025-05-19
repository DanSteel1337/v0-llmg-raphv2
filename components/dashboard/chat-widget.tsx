/**
 * Chat Widget Component
 *
 * A dashboard widget for chat functionality, showing recent conversations
 * and providing quick access to start new chats.
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 * - @/hooks/use-chat for conversation data
 */

"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { MessageSquare, Plus, Send, AlertCircle } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { formatDate } from "@/utils/formatting"
import { useToast } from "@/components/toast"
import { useChat } from "@/hooks/use-chat"
import type { Conversation } from "@/types"

interface ChatWidgetProps {
  userId: string
}

export function ChatWidget({ userId }: ChatWidgetProps) {
  const {
    conversations,
    isLoadingConversations,
    conversationsError,
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    createConversation,
    refreshConversations,
  } = useChat(userId)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { addToast } = useToast()

  // Handle API errors
  useEffect(() => {
    if (conversationsError) {
      console.error("Chat widget error:", conversationsError)
      setErrorMessage(conversationsError instanceof Error ? conversationsError.message : String(conversationsError))
      addToast(
        "Failed to load conversations: " +
          (conversationsError instanceof Error ? conversationsError.message : "Unknown error"),
        "error",
      )
    } else {
      setErrorMessage(null)
    }
  }, [conversationsError, addToast])

  // Retry loading conversations if there was an error
  const handleRetry = () => {
    setErrorMessage(null)
    refreshConversations()
  }

  const handleNewChat = async () => {
    try {
      setErrorMessage(null)
      await createConversation("New Conversation")
      addToast("Started a new conversation", "info")
    } catch (error) {
      console.error("Error creating conversation:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      setErrorMessage(`Failed to create conversation: ${message}`)
      addToast("Failed to create conversation: " + message, "error")
    }
  }

  const handleOpenChat = (conversation: Conversation) => {
    setErrorMessage(null)
    setActiveConversationId(conversation.id)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    try {
      setErrorMessage(null)
      await sendMessage(message)
      setMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      const message = error instanceof Error ? error.message : "Unknown error"
      setErrorMessage(`Failed to send message: ${message}`)
      addToast("Failed to send message: " + message, "error")
    }
  }

  const handleBackToList = () => {
    setErrorMessage(null)
    setActiveConversationId(undefined)
  }

  return (
    <DashboardCard title="Chat" description="Ask questions about your documents" isLoading={isLoadingConversations}>
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

        {!activeConversationId ? (
          <>
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Conversation
            </button>

            {conversations && conversations.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {conversations.slice(0, 3).map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      onClick={() => handleOpenChat(conversation)}
                      className="w-full flex items-center justify-between py-3 hover:bg-gray-50 px-2 rounded-md"
                    >
                      <div className="flex items-center">
                        <MessageSquare className="h-5 w-5 text-gray-400 mr-3" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                            {conversation.title}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(conversation.updated_at)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-4 text-gray-500">
                {errorMessage
                  ? "Unable to load conversations. Please try again."
                  : "No conversations yet. Start a new chat to ask questions about your documents."}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col h-64">
            <div className="flex items-center justify-between mb-3">
              <button onClick={handleBackToList} className="text-sm text-blue-600 hover:text-blue-800">
                ← Back to conversations
              </button>
              <span className="text-sm font-medium">
                {(conversations && conversations.find((c) => c.id === activeConversationId)?.title) || "Conversation"}
              </span>
            </div>

            <div className="flex-1 bg-gray-50 rounded-md p-3 mb-3 overflow-y-auto">
              <div className="text-center text-gray-500 text-sm py-4">Start asking questions about your documents.</div>
            </div>

            <form onSubmit={handleSendMessage} className="flex">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </DashboardCard>
  )
}
