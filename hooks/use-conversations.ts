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

import { useEffect } from "react"
import { useApi } from "@/hooks/use-api"
import type { Conversation } from "@/types"

export function useConversations(userId: string) {
  const {
    data: conversations,
    isLoading,
    error,
    execute: fetchConversations,
  } = useApi<Conversation[], []>(async () => {
    const response = await fetch(`/api/conversations?userId=${userId}`)

    if (!response.ok) {
      throw new Error("Failed to fetch conversations")
    }

    const { data } = await response.json()
    return data.conversations || []
  })

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

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
    await fetchConversations()
    return data.conversation
  }

  const deleteConversation = async (id: string) => {
    const response = await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      throw new Error("Failed to delete conversation")
    }

    await fetchConversations()
  }

  return {
    conversations: conversations || [],
    isLoading,
    error,
    createConversation,
    deleteConversation,
    refreshConversations: fetchConversations,
  }
}
