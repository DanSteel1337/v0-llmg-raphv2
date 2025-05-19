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

import { useState, useEffect, useCallback } from "react"
import { useApi } from "@/hooks/use-api"
import {
  fetchConversations,
  createConversation as apiCreateConversation,
  fetchMessages,
  sendMessage as apiSendMessage,
} from "@/services/client-api-service"
import type { ChatMessage, Conversation } from "@/types"

export function useChat(userId: string, conversationId?: string) {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)

  // Wrap the fetchMessages call with useCallback
  const fetchMessagesCallback = useCallback(() => {
    if (!activeConversationId) return Promise.resolve([])
    return fetchMessages(activeConversationId)
  }, [activeConversationId])

  // Wrap the fetchConversations call with useCallback
  const fetchConversationsCallback = useCallback(() => {
    return fetchConversations(userId)
  }, [userId])

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

  // Create a new conversation
  const createConversation = async (title: string) => {
    const conversation = await apiCreateConversation(userId, title)
    setActiveConversationId(conversation.id)
    await loadConversations()
    return conversation
  }

  // Send a message
  const sendMessage = async (content: string) => {
    if (!activeConversationId) {
      throw new Error("No active conversation")
    }

    setIsTyping(true)

    try {
      await apiSendMessage(activeConversationId, content, userId)
      await loadMessages()
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
      loadMessages()
    } else {
      setMessages([])
    }
  }, [activeConversationId, loadMessages])

  // Update messages when fetched messages change
  useEffect(() => {
    if (fetchedMessages) {
      setMessages(fetchedMessages)
    }
  }, [fetchedMessages])

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

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
