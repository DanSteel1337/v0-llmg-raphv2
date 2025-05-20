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
 *
 * Dependencies:
 * - @/hooks/use-api for standardized API interactions
 * - @/services/client-api-service for backend communication
 * - @/types for type definitions
 *
 * @module hooks/use-chat
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useApi } from "@/hooks/use-api"
import { useAuth } from "./use-auth"
import {
  fetchConversations,
  createConversation as apiCreateConversation,
  fetchMessages,
  sendMessage as apiSendMessage,
} from "@/services/client-api-service"
import type { ChatMessage as Message, Conversation } from "@/types"

export function useChat() {
  const { user } = useAuth()
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(user?.conversations?.[0]?.id)
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [conversations, setConversations] = useState<Conversation[]>(user?.conversations || [])
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ensure userId is valid before making any requests
  const safeUserId = user?.id || ""

  // Wrap the fetchMessages call with useCallback and proper validation
  const fetchMessagesCallback = useCallback(() => {
    if (!activeConversationId) {
      console.log("No active conversation, skipping fetchMessages")
      return Promise.resolve([])
    }

    console.log(`Fetching messages for conversation: ${activeConversationId}`)
    return fetchMessages(activeConversationId)
  }, [activeConversationId])

  // Wrap the fetchConversations call with useCallback and proper validation
  const fetchConversationsCallback = useCallback(() => {
    if (!safeUserId) {
      console.log("No userId provided, skipping fetchConversations")
      return Promise.resolve([])
    }

    console.log(`Fetching conversations for user: ${safeUserId}`)
    return fetchConversations(safeUserId)
  }, [safeUserId])

  // Fetch messages for the active conversation
  const {
    data: fetchedMessages,
    isLoading: _isLoadingMessages,
    error: messagesError,
    execute: loadMessages,
  } = useApi<Message[], []>(fetchMessagesCallback)

  // Fetch conversations
  const {
    data: _conversations,
    isLoading: _isLoadingConversations,
    error: conversationsError,
    execute: loadConversations,
  } = useApi<Conversation[], []>(fetchConversationsCallback)

  // Create a new conversation with proper error handling
  const handleCreateConversation = useCallback(
    async (title?: string) => {
      if (!safeUserId) {
        throw new Error("User not authenticated")
      }

      try {
        const newConversation = await apiCreateConversation(safeUserId, title)

        if (newConversation) {
          // Add the new conversation to the state
          setConversations((prevConvos) => [newConversation, ...prevConvos])

          // Set it as the active conversation
          setActiveConversationId(newConversation.id)

          // Clear messages
          setMessages([])
        }

        return newConversation
      } catch (err) {
        console.error("Error creating conversation:", err)
        throw err
      }
    },
    [safeUserId],
  )

  // Send a message with validation and error handling
  const handleSendMessage = useCallback(
    async (content: string) => {
      // Enhanced validation
      if (!activeConversationId) {
        console.error("Cannot send message: No active conversation")
        throw new Error("No active conversation")
      }

      if (!safeUserId) {
        console.error("Cannot send message: No user ID")
        throw new Error("User ID is required to send a message")
      }

      if (!content || typeof content !== "string" || content.trim() === "") {
        console.error("Cannot send message: Empty content", {
          contentType: typeof content,
          contentLength: typeof content === "string" ? content.length : 0,
        })
        throw new Error("Message content cannot be empty")
      }

      setIsTyping(true)

      try {
        console.log(`Sending message to conversation: ${activeConversationId}`)

        // Log the exact message being sent
        console.log("Sending message with exact content:", {
          conversationId: activeConversationId,
          content, // Log full content
          contentLength: content.length,
          userId: safeUserId,
        })

        // Add the user message to the local state immediately for optimistic UI update
        const tempUserMessage: Message = {
          id: `temp_${Date.now()}`,
          conversation_id: activeConversationId,
          role: "user",
          content,
          created_at: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, tempUserMessage])

        await apiSendMessage(activeConversationId, content, safeUserId)

        // Reload messages to get the new message and response
        await loadMessages()
        setRetryCount(0) // Reset retry count on success
        return true
      } catch (error) {
        console.error("Error sending message:", {
          error: error instanceof Error ? error.message : String(error),
          conversationId: activeConversationId,
          contentType: typeof content,
          contentLength: content.length,
        })

        // Implement retry logic for transient errors
        if (retryCount < 2) {
          console.log(`Retrying send message (${retryCount + 1}/2)...`)
          setRetryCount((prev) => prev + 1)
          // Wait briefly before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return handleSendMessage(content)
        }

        throw error
      } finally {
        setIsTyping(false)
      }
    },
    [activeConversationId, safeUserId, retryCount, loadMessages],
  )

  // Load messages when the active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      console.log(`Active conversation changed to: ${activeConversationId}, loading messages`)
      loadMessages()
    } else {
      console.log("No active conversation, clearing messages")
      setMessages([])
    }
  }, [activeConversationId, loadMessages])

  // Update messages when fetched messages change
  useEffect(() => {
    if (fetchedMessages) {
      console.log(`Received ${fetchedMessages.length} messages from API`)
      setMessages(fetchedMessages)
    }
  }, [fetchedMessages])

  // Load conversations on mount or when userId changes
  useEffect(() => {
    if (safeUserId) {
      console.log(`Loading conversations for user: ${safeUserId}`)
      loadConversations()
    }
  }, [safeUserId, loadConversations])

  // Fetch conversations on mount and when user changes
  useEffect(() => {
    if (!user?.id) {
      setConversations([])
      setActiveConversationId(undefined)
      setMessages([])
      return
    }

    const loadConversations = async () => {
      setIsLoadingConversations(true)
      setError(null)
      try {
        const convos = await fetchConversations(user.id)
        setConversations(convos)

        // Set active conversation to the most recent one if available
        if (convos.length > 0 && !activeConversationId) {
          setActiveConversationId(convos[0].id)
        }
      } catch (err) {
        console.error("Error fetching conversations:", err)
        setError(err instanceof Error ? err.message : "Failed to load conversations")
      } finally {
        setIsLoadingConversations(false)
      }
    }

    loadConversations()
  }, [user?.id, activeConversationId])

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }

    const loadMessages = async () => {
      setIsLoadingMessages(true)
      setError(null)
      try {
        const msgs = await fetchMessages(activeConversationId)
        setMessages(msgs)
      } catch (err) {
        console.error("Error fetching messages:", err)
        setError(err instanceof Error ? err.message : "Failed to load messages")
      } finally {
        setIsLoadingMessages(false)
      }
    }

    loadMessages()
  }, [activeConversationId])

  // Refresh messages
  const handleRefreshMessages = useCallback(async () => {
    if (!activeConversationId) {
      return
    }

    try {
      const msgs = await fetchMessages(activeConversationId)
      setMessages(msgs)
    } catch (err) {
      console.error("Error refreshing messages:", err)
      throw err
    }
  }, [activeConversationId])

  return {
    messages,
    conversations,
    isLoadingMessages,
    isLoadingConversations,
    messagesError,
    conversationsError,
    isTyping,
    activeConversationId,
    setActiveConversationId,
    sendMessage: handleSendMessage,
    createConversation: handleCreateConversation,
    refreshMessages: handleRefreshMessages,
    refreshConversations: loadConversations,
  }
}
