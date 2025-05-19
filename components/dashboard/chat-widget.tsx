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
import { useState } from "react"
import type React from "react"

import { MessageSquare, Plus, Send } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { formatDate } from "@/utils"
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
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    createConversation,
  } = useChat(userId)
  const [message, setMessage] = useState("")
  const { addToast } = useToast()

  const handleNewChat = async () => {
    try {
      await createConversation("New Conversation")
      addToast("Started a new conversation", "info")
    } catch (error) {
      addToast("Failed to create conversation", "error")
    }
  }

  const handleOpenChat = (conversation: Conversation) => {
    setActiveConversationId(conversation.id)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    try {
      await sendMessage(message)
      setMessage("")
    } catch (error) {
      addToast("Failed to send message", "error")
    }
  }

  const handleBackToList = () => {
    setActiveConversationId(undefined)
  }

  return (
    <DashboardCard title="Chat" description="Ask questions about your documents" isLoading={isLoadingConversations}>
      <div className="space-y-4">
        {!activeConversationId ? (
          <>
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Conversation
            </button>

            {conversations.length > 0 ? (
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
                No conversations yet. Start a new chat to ask questions about your documents.
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
                {conversations.find((c) => c.id === activeConversationId)?.title || "Conversation"}
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
