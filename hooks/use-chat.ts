/**
 * Chat Hook
 *
 * Custom hook for managing chat conversations and messages.
 *
 * Dependencies:
 * - @/hooks/use-api for API interaction
 * - @/types for chat types
 */

"use client"

import { useState, useEffect } from "react"
import { useApi } from "@/hooks/use-api"
import type { ChatMessage, Conversation } from "@/types"

export function useChat(userId: string, conversationId?: string) {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)

  // Fetch messages for the active conversation
  const {
    data: fetchedMessages,
    isLoading: isLoadingMessages,
    error: messagesError,
    execute: fetchMessages,
  } = useApi<ChatMessage[], []>(async () => {
    if (!activeConversationId) return []

    const response = await fetch(`/api/chat/messages?conversationId=${activeConversationId}`)

    if (!response.ok) {
      throw new Error("Failed to fetch messages")
    }

    const { data } = await response.json()
    return data.messages || []
  })

  // Fetch conversations
  const {
    data: conversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
    execute: fetchConversations,
  } = useApi<Conversation[], []>(async () => {
    const response = await fetch(`/api/conversations?userId=${userId}`)

    if (!response.ok) {
      throw new Error("Failed to fetch conversations")
    }

    const { data } = await response.json()
    return data.conversations || []
  })

  // Create a new conversation
  const createConversation = async (title: string) => {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        title,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to create conversation")
    }

    const { data } = await response.json()
    setActiveConversationId(data.conversation.id)
    await fetchConversations()
    return data.conversation
  }

  // Send a message
  const sendMessage = async (content: string) => {
    if (!activeConversationId) {
      throw new Error("No active conversation")
    }

    setIsTyping(true)

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          content,
          userId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      await fetchMessages()
      return true
    } catch (error) {
      console.error("Error sending message:", error)
      throw error
    } finally {
      setIsTyping(false)
    }
  }

  // Load messages when the active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      fetchMessages()
    } else {
      setMessages([])
    }
  }, [activeConversationId, fetchMessages])

  // Update messages when fetched messages change
  useEffect(() => {
    if (fetchedMessages) {
      setMessages(fetchedMessages)
    }
  }, [fetchedMessages])

  // Load conversations on mount
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  return {
    messages,
    conversations: conversations || [],
    isLoadingMessages,
    isLoadingConversations,
    messagesError,
    conversationsError,
    isTyping,
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    createConversation,
    refreshMessages: fetchMessages,
    refreshConversations: fetchConversations,
  }
}
