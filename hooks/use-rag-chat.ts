"use client"

import { useState, useEffect } from "react"

interface Citation {
  id: string
  text: string
  document: string
  page?: number
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  citations?: Citation[]
  isLoading?: boolean
}

interface ChatOptions {
  responseLength?: number
  citationStyle?: string
}

export function useRagChat(userId: string, initialConversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your RAG assistant. Ask me anything about your documents.",
      timestamp: new Date(),
    },
  ])
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId)
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load conversation history if conversationId is provided
  useEffect(() => {
    const loadConversation = async () => {
      if (!conversationId) return

      try {
        const response = await fetch(`/api/chat/conversations/${conversationId}`)

        if (!response.ok) {
          throw new Error("Failed to load conversation")
        }

        const data = await response.json()

        // Format messages
        const formattedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          citations: msg.citations,
        }))

        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: "Hello! I'm your RAG assistant. Ask me anything about your documents.",
            timestamp: new Date(),
          },
          ...formattedMessages,
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        console.error("Error loading conversation:", err)
      }
    }

    loadConversation()
  }, [conversationId])

  const sendMessage = async (content: string, options: ChatOptions = {}) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    }

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setIsTyping(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages.filter((m) => m.id !== "welcome"), userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          userId,
          conversationId,
          responseLength: options.responseLength || 2,
          citationStyle: options.citationStyle || "inline",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      const data = await response.json()

      // Update conversation ID if this is a new conversation
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
      }

      // Update the assistant message with the response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content: data.content,
                citations: data.citations,
                isLoading: false,
              }
            : msg,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error sending message:", err)

      // Update the assistant message with an error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content: "Sorry, I encountered an error while processing your request.",
                isLoading: false,
              }
            : msg,
        ),
      )
    } finally {
      setIsTyping(false)
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Hello! I'm your RAG assistant. Ask me anything about your documents.",
        timestamp: new Date(),
      },
    ])
    setConversationId(undefined)
  }

  return {
    messages,
    conversationId,
    isTyping,
    error,
    sendMessage,
    clearChat,
  }
}
