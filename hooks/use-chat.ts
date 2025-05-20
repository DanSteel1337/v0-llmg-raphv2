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
 * - @/hooks/use-api for standardized API interactions
 * - @/services/client-api-service for backend communication
 * - @/types for type definitions
 *
 * @module hooks/use-chat
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useApi } from "@/hooks/use-api"
import {
  fetchConversations,
  createConversation as apiCreateConversation,
  fetchMessages,
  sendMessage as apiSendMessage,
} from "@/services/client-api-service"
import type { ChatMessage, Conversation } from "@/types"

/**
 * Hook for chat functionality
 * @param userId User ID for the current user
 * @param initialConversationId Optional initial conversation ID to load
 * @returns Chat state and methods
 */
export function useChat(userId: string, initialConversationId?: string) {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(initialConversationId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Ensure userId is valid before making any requests
  const safeUserId = userId || ""

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
    isLoading: isLoadingMessages,
    error: messagesError,
    execute: loadMessages,
  } = useApi<ChatMessage[], []>(fetchMessagesCallback)

  // Fetch conversations
  const {
    data: conversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
    execute: loadConversations,
  } = useApi<Conversation[], []>(fetchConversationsCallback)

  /**
   * Create a new conversation with proper error handling
   * @param title Optional title for the conversation
   * @returns The created conversation
   */
  const createConversation = async (title: string) => {
    if (!safeUserId) {
      throw new Error("User ID is required to create a conversation")
    }

    if (!title || typeof title !== "string" || title.trim() === "") {
      throw new Error("Conversation title cannot be empty")
    }

    try {
      console.log(`Creating conversation with title: ${title}`)
      const conversation = await apiCreateConversation(safeUserId, title)

      if (!conversation?.id) {
        throw new Error("Failed to create conversation: No conversation ID returned")
      }

      console.log(`Conversation created with ID: ${conversation.id}`)
      setActiveConversationId(conversation.id)
      await loadConversations()
      return conversation
    } catch (error) {
      console.error(`Error creating conversation:`, error)
      throw error
    }
  }

  /**
   * Send a message with validation and error handling
   * @param content Message content
   * @returns True if message was sent successfully
   */
  const sendMessage = async (content: string) => {
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
      const tempUserMessage: ChatMessage = {
        id: `temp_${Date.now()}`,
        conversation_id: activeConversationId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, tempUserMessage])

      const response = await apiSendMessage(activeConversationId, content, safeUserId)
      
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
        return sendMessage(content)
      }

      throw error
    } finally {
      setIsTyping(false)
    }
  }

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
    refreshMessages: loadMessages,
    refreshConversations: loadConversations,
  }
}
