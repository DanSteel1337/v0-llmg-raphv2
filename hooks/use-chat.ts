/**
 * Chat Hook
 *
 * Custom hook for managing chat conversations and messages.
 * Provides functionality for loading conversations, managing messages,
 * and handling the conversation lifecycle.
 *
 * Features:
 * - Conversation creation and management
 * - Message sending and retrieval
 * - State tracking for loading and typing indicators
 * - Error handling and reporting
 * - Automatic refresh of conversations and messages
 *
 * Dependencies:
 * - @/services/client-api-service for API calls
 * - @/components/toast for notifications
 *
 * @module hooks/use-chat
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import {
  fetchConversations,
  fetchMessages,
  createConversation as apiCreateConversation,
  sendMessage as apiSendMessage,
} from "@/services/client-api-service"
import type { Conversation, Message } from "@/types"
import { useToast } from "@/components/toast"

export function useChat(userId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [conversationsError, setConversationsError] = useState<Error | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [messagesError, setMessagesError] = useState<Error | null>(null)

  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined)
  const [isTyping, setIsTyping] = useState(false)

  const { addToast } = useToast()

  // Fetch conversations
  const refreshConversations = useCallback(async () => {
    if (!userId) return

    try {
      console.log("Fetching conversations for user:", userId)
      setIsLoadingConversations(true)
      setConversationsError(null)

      const data = await fetchConversations(userId)
      setConversations(data)
    } catch (err) {
      console.error("Error fetching conversations:", err)
      const error = err instanceof Error ? err : new Error("Failed to load conversations")
      setConversationsError(error)
      addToast(`Failed to load conversations: ${error.message}`, "error")
    } finally {
      setIsLoadingConversations(false)
    }
  }, [userId, addToast])

  // Fetch messages for active conversation
  const refreshMessages = useCallback(async () => {
    if (!activeConversationId) {
      console.log("No active conversation, clearing messages")
      setMessages([])
      return
    }

    try {
      setIsLoadingMessages(true)
      setMessagesError(null)

      const data = await fetchMessages(activeConversationId)
      setMessages(data)
    } catch (err) {
      console.error("Error fetching messages:", err)
      const error = err instanceof Error ? err : new Error("Failed to load messages")
      setMessagesError(error)
      addToast(`Failed to load messages: ${error.message}`, "error")
    } finally {
      setIsLoadingMessages(false)
    }
  }, [activeConversationId, addToast])

  // Initial fetch of conversations
  useEffect(() => {
    if (userId) {
      console.log("Loading conversations for user:", userId)
      refreshConversations()
    }
  }, [userId, refreshConversations])

  // Fetch messages when active conversation changes
  useEffect(() => {
    refreshMessages()
  }, [activeConversationId, refreshMessages])

  // Create a new conversation
  const createConversation = useCallback(
    async (title: string) => {
      if (!userId) {
        throw new Error("User ID is required")
      }

      try {
        const newConversation = await apiCreateConversation(title, userId)

        // Add to conversations list and set as active
        setConversations((prev) => [newConversation, ...prev])
        setActiveConversationId(newConversation.id)

        return newConversation
      } catch (err) {
        console.error("Error creating conversation:", err)
        const error = err instanceof Error ? err : new Error("Failed to create conversation")
        addToast(`Failed to create conversation: ${error.message}`, "error")
        throw error
      }
    },
    [userId, addToast],
  )

  // Send a message in the active conversation
  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId) {
        throw new Error("No active conversation")
      }

      if (!content.trim()) {
        throw new Error("Message cannot be empty")
      }

      try {
        // Add user message to the UI immediately
        const tempUserMessage: Message = {
          id: `temp-${Date.now()}`,
          conversation_id: activeConversationId,
          role: "user",
          content,
          created_at: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, tempUserMessage])

        // Show typing indicator
        setIsTyping(true)

        // Send message to API
        const response = await apiSendMessage(activeConversationId, content)

        // Hide typing indicator
        setIsTyping(false)

        // Update messages with the actual response
        setMessages((prev) => [
          ...prev.filter((msg) => msg.id !== tempUserMessage.id), // Remove temp message
          response.userMessage,
          response.aiMessage,
        ])

        // Update conversation in the list (it might have a new title or updated_at)
        if (response.updatedConversation) {
          setConversations((prev) =>
            prev.map((conv) => (conv.id === activeConversationId ? response.updatedConversation : conv)),
          )
        }

        return response
      } catch (err) {
        console.error("Error sending message:", err)
        setIsTyping(false)
        const error = err instanceof Error ? err : new Error("Failed to send message")
        addToast(`Failed to send message: ${error.message}`, "error")
        throw error
      }
    },
    [activeConversationId, addToast],
  )

  return {
    conversations,
    isLoadingConversations,
    conversationsError,
    refreshConversations,

    messages,
    isLoadingMessages,
    messagesError,
    refreshMessages,

    activeConversationId,
    setActiveConversationId,

    createConversation,
    sendMessage,

    isTyping,
  }
}
