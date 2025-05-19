/**
 * Conversations Hook
 *
 * Custom hook for managing chat conversations.
 *
 * Dependencies:
 * - @/hooks/use-api for API interaction
 * - @/types for conversation types
 */

"use client"

import { useEffect, useCallback } from "react"
import { useApi } from "@/hooks/use-api"
import { fetchConversations, createConversation as apiCreateConversation } from "@/services/client-api-service"
import type { Conversation } from "@/types"

export function useConversations(userId: string) {
  // Wrap the fetchConversations call with useCallback
  const fetchConversationsCallback = useCallback(() => {
    return fetchConversations(userId)
  }, [userId])

  const {
    data: conversations,
    isLoading,
    error,
    execute: loadConversations,
  } = useApi<Conversation[], []>(fetchConversationsCallback)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const createConversation = async (title: string) => {
    const conversation = await apiCreateConversation(userId, title)
    await loadConversations()
    return conversation
  }

  const deleteConversation = async (id: string) => {
    const response = await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      throw new Error("Failed to delete conversation")
    }

    await loadConversations()
  }

  return {
    conversations: conversations || [],
    isLoading,
    error,
    createConversation,
    deleteConversation,
    refreshConversations: loadConversations,
  }
}
