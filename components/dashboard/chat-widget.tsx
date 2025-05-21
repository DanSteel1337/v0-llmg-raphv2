/**
 * Enhanced Chat Widget Component
 *
 * A dashboard widget for RAG chat functionality, providing a rich interface for
 * conversational AI interactions with document context and streaming responses.
 *
 * Features:
 * - Real-time streaming of AI responses
 * - Conversation history management
 * - Multiple conversation modes (chat, Q&A, analysis)
 * - Citation and source display
 * - Markdown and code syntax highlighting
 * - Virtualized message list for performance
 * - Accessibility features
 * - Mobile responsiveness
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 * - @/hooks/use-chat for conversation data and messaging
 * - @/utils/formatting for date and text formatting
 * - react-markdown for rendering markdown content
 * - react-syntax-highlighter for code blocks
 * - react-virtuoso for virtualized scrolling
 */

"use client"

import React from "react"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Virtuoso } from "react-virtuoso"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import {
  MessageSquare,
  Plus,
  Send,
  AlertCircle,
  ArrowLeft,
  User,
  Bot,
  FileText,
  Clock,
  Settings,
  ChevronDown,
  X,
  Clipboard,
  Check,
  RefreshCw,
  Trash2,
  Download,
  Search,
  BookOpen,
  Brain,
  MessageCircle,
  HelpCircle,
} from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { formatDate, truncateText } from "@/utils/formatting"
import { useToast } from "@/components/toast"
import { useChat } from "@/hooks/use-chat"
import { ErrorBoundary } from "@/components/error-boundary"
import type { Conversation, ChatMessage } from "@/types"

// Define conversation modes
type ConversationMode = "chat" | "qa" | "analysis"

// Define message source interface
interface MessageSource {
  documentName: string
  documentId: string
  score?: number
}

// Enhanced chat widget props
interface ChatWidgetProps {
  userId: string
  initialConversationId?: string
  height?: string | number
  showTitle?: boolean
  allowModeSelection?: boolean
  defaultMode?: ConversationMode
  showConversationList?: boolean
  onConversationSelect?: (conversationId: string) => void
}

// Message component props
interface MessageProps {
  message: ChatMessage
  isLatest: boolean
  onRetry?: () => void
  showTimestamp?: boolean
}

/**
 * Message component for rendering individual chat messages
 */
const Message = React.memo(function Message({ message, isLatest, onRetry, showTimestamp = true }: MessageProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === "user"
  const hasError = message.error === true
  const hasSources = message.sources && message.sources.length > 0

  // Handle copy message content
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  return (
    <div
      className={`group flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
      data-testid={`message-${message.id}`}
    >
      <div
        className={`relative max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-blue-100 text-blue-900 rounded-tr-none"
            : hasError
              ? "bg-red-50 border border-red-200 text-gray-800 rounded-tl-none"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-none"
        }`}
      >
        {/* Message header with role icon and timestamp */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center">
            <span
              className={`flex items-center justify-center w-5 h-5 rounded-full mr-2 ${
                isUser ? "bg-blue-200" : hasError ? "bg-red-200" : "bg-gray-200"
              }`}
            >
              {isUser ? (
                <User className="h-3 w-3 text-blue-700" aria-hidden="true" />
              ) : hasError ? (
                <AlertCircle className="h-3 w-3 text-red-700" aria-hidden="true" />
              ) : (
                <Bot className="h-3 w-3 text-gray-700" aria-hidden="true" />
              )}
            </span>
            <span className="text-xs font-medium">{isUser ? "You" : hasError ? "Error" : "AI Assistant"}</span>
          </div>
          {showTimestamp && message.created_at && (
            <div className="text-xs text-gray-500 flex items-center ml-2">
              <Clock className="h-3 w-3 mr-1 opacity-70" aria-hidden="true" />
              <time dateTime={message.created_at}>{formatDate(message.created_at, true)}</time>
            </div>
          )}
        </div>

        {/* Message content with markdown support */}
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {hasError ? (
            <div className="text-red-600">
              <p>Sorry, there was an error generating a response.</p>
              {isLatest && onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-2 flex items-center text-xs font-medium text-red-600 hover:text-red-800"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </button>
              )}
            </div>
          ) : (
            <ReactMarkdown
              components={{
                // Custom rendering for code blocks with syntax highlighting
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "")
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                      className="rounded-md text-xs"
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={`${className || ""} rounded-md px-1 py-0.5 bg-gray-100`} {...props}>
                      {children}
                    </code>
                  )
                },
                // Custom rendering for links
                a: ({ node, ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Sources section */}
        {hasSources && (
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500 font-medium mb-1.5">Sources:</div>
            <div className="flex flex-wrap gap-1.5">
              {message.sources.map((source, idx) => (
                <div
                  key={idx}
                  className="flex items-center text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                  title={`Source: ${source}`}
                >
                  <FileText className="h-3 w-3 mr-1.5 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate max-w-[150px]">{source}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message actions */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
            title="Copy message"
            aria-label="Copy message content"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
})

/**
 * Typing indicator component
 */
const TypingIndicator = React.memo(function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4" aria-live="polite" aria-label="Assistant is typing">
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 max-w-[85%] rounded-tl-none">
        <div className="flex items-center">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 mr-2">
            <Bot className="h-3 w-3 text-gray-700" aria-hidden="true" />
          </span>
          <span className="text-xs font-medium">AI Assistant</span>
        </div>
        <div className="flex items-center space-x-1 mt-2 ml-1">
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
        </div>
      </div>
    </div>
  )
})

/**
 * Empty state component for conversations
 */
const EmptyState = React.memo(function EmptyState({
  onNewChat,
  errorMessage,
  onRetry,
}: {
  onNewChat: () => void
  errorMessage?: string | null
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center">
      <div className="bg-gray-100 rounded-full p-3 mb-4">
        <MessageSquare className="h-6 w-6 text-gray-500" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-md">
        {errorMessage
          ? "Unable to load conversations. Please try again."
          : "Start a new chat to ask questions about your documents."}
      </p>
      {errorMessage && onRetry ? (
        <button
          onClick={onRetry}
          className="mb-4 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </button>
      ) : null}
      <button
        onClick={onNewChat}
        className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Plus className="mr-2 h-4 w-4" />
        New Conversation
      </button>
    </div>
  )
})

/**
 * Conversation list component
 */
const ConversationList = React.memo(function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  isLoading,
  errorMessage,
  onRetry,
}: {
  conversations: Conversation[]
  activeConversationId?: string
  onSelectConversation: (conversation: Conversation) => void
  onNewChat: () => void
  isLoading: boolean
  errorMessage?: string | null
  onRetry?: () => void
}) {
  // Filter out conversations that might be undefined or null
  const validConversations = conversations.filter(Boolean)

  if (isLoading) {
    return (
      <div className="py-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center">
              <div className="rounded-full bg-gray-200 h-8 w-8 mr-3"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (validConversations.length === 0) {
    return <EmptyState onNewChat={onNewChat} errorMessage={errorMessage} onRetry={onRetry} />
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onNewChat}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Plus className="mr-2 h-4 w-4" />
        New Conversation
      </button>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{errorMessage}</span>
          </div>
          {onRetry && (
            <button onClick={onRetry} className="mt-2 text-sm text-red-700 hover:text-red-900 underline">
              Retry
            </button>
          )}
        </div>
      )}

      <ul className="divide-y divide-gray-200">
        {validConversations.map((conversation) => (
          <li key={conversation.id}>
            <button
              onClick={() => onSelectConversation(conversation)}
              className={`w-full flex items-center justify-between py-3 hover:bg-gray-50 px-3 rounded-md ${
                activeConversationId === conversation.id ? "bg-blue-50 border border-blue-100" : ""
              }`}
              aria-current={activeConversationId === conversation.id ? "page" : undefined}
            >
              <div className="flex items-center">
                <MessageSquare
                  className={`h-5 w-5 mr-3 ${
                    activeConversationId === conversation.id ? "text-blue-500" : "text-gray-400"
                  }`}
                />
                <div className="text-left">
                  <p
                    className={`text-sm font-medium truncate max-w-[200px] ${
                      activeConversationId === conversation.id ? "text-blue-700" : "text-gray-900"
                    }`}
                  >
                    {conversation.title}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(conversation.updated_at)}</p>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
})

/**
 * Chat input component
 */
const ChatInput = React.memo(function ChatInput({
  message,
  setMessage,
  onSendMessage,
  isTyping,
  mode,
  onChangeMode,
  allowModeSelection,
}: {
  message: string
  setMessage: (message: string) => void
  onSendMessage: (e: React.FormEvent) => void
  isTyping: boolean
  mode: ConversationMode
  onChangeMode: (mode: ConversationMode) => void
  allowModeSelection: boolean
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [showModeSelector, setShowModeSelector] = useState(false)

  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }, [message])

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (message.trim() && !isTyping) {
        onSendMessage(e)
      }
    }
  }

  // Mode descriptions for the selector
  const modeDescriptions = {
    chat: "Conversational mode for general questions",
    qa: "Precise question answering with citations",
    analysis: "In-depth analysis of document content",
  }

  // Mode icons for the selector
  const modeIcons = {
    chat: <MessageCircle className="h-4 w-4 mr-2" />,
    qa: <HelpCircle className="h-4 w-4 mr-2" />,
    analysis: <Brain className="h-4 w-4 mr-2" />,
  }

  return (
    <div className="relative">
      {/* Mode selector dropdown */}
      {allowModeSelection && (
        <div className="absolute right-2 -top-10 z-10">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModeSelector(!showModeSelector)}
              className="flex items-center text-xs bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-700 hover:bg-gray-50"
            >
              {modeIcons[mode]}
              <span className="capitalize">{mode} Mode</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </button>

            {showModeSelector && (
              <div className="absolute right-0 mt-1 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  {(["chat", "qa", "analysis"] as ConversationMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        onChangeMode(m)
                        setShowModeSelector(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm ${
                        mode === m ? "bg-gray-100 text-gray-900" : "text-gray-700"
                      } hover:bg-gray-100 flex items-center justify-between`}
                      role="menuitem"
                    >
                      <div className="flex items-center">
                        {modeIcons[m]}
                        <span className="capitalize">{m}</span>
                      </div>
                      {mode === m && <Check className="h-4 w-4 text-blue-500" />}
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">{modeDescriptions[mode]}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message input form */}
      <form onSubmit={onSendMessage} className="flex flex-col">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isTyping
                ? "Wait for response..."
                : mode === "qa"
                  ? "Ask a specific question..."
                  : mode === "analysis"
                    ? "Ask for analysis..."
                    : "Type your message..."
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[40px] max-h-[150px] disabled:bg-gray-50 disabled:text-gray-500"
            disabled={isTyping}
            rows={1}
            aria-label="Message input"
          />
          <button
            type="submit"
            className="absolute right-2 bottom-2 p-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isTyping || !message.trim()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <div>
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">Enter</kbd> to send,{" "}
            <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">Shift+Enter</kbd> for new line
          </div>
          <div>{message.length > 0 ? `${message.length} characters` : ""}</div>
        </div>
      </form>
    </div>
  )
})

/**
 * Main Chat Widget Component
 */
export function ChatWidget({
  userId,
  initialConversationId,
  height = "600px",
  showTitle = true,
  allowModeSelection = true,
  defaultMode = "chat",
  showConversationList = true,
  onConversationSelect,
}: ChatWidgetProps) {
  // Chat hook for messaging functionality
  const {
    conversations,
    isLoadingConversations,
    conversationsError,
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    createConversation,
    refreshConversations,
    messages,
    isTyping,
    streamingMessage,
    retryLastMessage,
    deleteConversation,
  } = useChat(userId, initialConversationId)

  // Local state
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [mode, setMode] = useState<ConversationMode>(defaultMode)
  const [showSettings, setShowSettings] = useState(false)
  const { addToast } = useToast()
  const virtuosoRef = useRef(null)

  // Set initial conversation ID if provided
  useEffect(() => {
    if (initialConversationId && initialConversationId !== activeConversationId) {
      setActiveConversationId(initialConversationId)
    }
  }, [initialConversationId, activeConversationId, setActiveConversationId])

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

  // Scroll to bottom when new messages arrive or when typing
  useEffect(() => {
    if (virtuosoRef.current) {
      // @ts-ignore - Virtuoso has a scrollToIndex method
      virtuosoRef.current.scrollToIndex({
        index: messages.length + (isTyping || streamingMessage ? 1 : 0) - 1,
        behavior: "smooth",
      })
    }
  }, [messages, isTyping, streamingMessage])

  // Retry loading conversations if there was an error
  const handleRetry = useCallback(() => {
    setErrorMessage(null)
    refreshConversations()
  }, [refreshConversations])

  // Create a new conversation
  const handleNewChat = useCallback(async () => {
    try {
      setErrorMessage(null)
      await createConversation("New Conversation")
      addToast("Started a new conversation", "info")
    } catch (error) {
      console.error("Error creating conversation:", error)
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      setErrorMessage(`Failed to create conversation: ${errorMsg}`)
      addToast("Failed to create conversation: " + errorMsg, "error")
    }
  }, [createConversation, addToast])

  // Open an existing conversation
  const handleOpenChat = useCallback(
    (conversation: Conversation) => {
      setErrorMessage(null)
      setActiveConversationId(conversation.id)
      if (onConversationSelect) {
        onConversationSelect(conversation.id)
      }
    },
    [setActiveConversationId, onConversationSelect],
  )

  // Send a message
  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!message.trim() || isTyping) return

      try {
        setErrorMessage(null)
        await sendMessage(message, { mode })
        setMessage("")
      } catch (error) {
        console.error("Error sending message:", error)
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        setErrorMessage(`Failed to send message: ${errorMsg}`)
        addToast("Failed to send message: " + errorMsg, "error")
      }
    },
    [message, isTyping, sendMessage, mode, addToast],
  )

  // Return to conversation list
  const handleBackToList = useCallback(() => {
    setErrorMessage(null)
    setActiveConversationId(undefined)
  }, [setActiveConversationId])

  // Delete current conversation
  const handleDeleteConversation = useCallback(async () => {
    if (!activeConversationId) return

    try {
      await deleteConversation(activeConversationId)
      addToast("Conversation deleted", "info")
      setActiveConversationId(undefined)
    } catch (error) {
      console.error("Error deleting conversation:", error)
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      setErrorMessage(`Failed to delete conversation: ${errorMsg}`)
      addToast("Failed to delete conversation: " + errorMsg, "error")
    }
  }, [activeConversationId, deleteConversation, addToast, setActiveConversationId])

  // Change conversation mode
  const handleChangeMode = useCallback(
    (newMode: ConversationMode) => {
      setMode(newMode)
      addToast(`Switched to ${newMode} mode`, "info")
    },
    [addToast],
  )

  // Ensure conversations is always an array
  const safeConversations = useMemo(() => (Array.isArray(conversations) ? conversations : []), [conversations])

  // Get active conversation title
  const activeConversationTitle = useMemo(
    () => safeConversations.find((c) => c.id === activeConversationId)?.title || "Conversation",
    [safeConversations, activeConversationId],
  )

  // Combine regular messages with streaming message
  const allMessages = useMemo(() => {
    if (!streamingMessage) return messages

    // Check if we already have this message in the regular messages
    const exists = messages.some((m) => m.id === streamingMessage.id)
    if (exists) return messages

    return [...messages, streamingMessage]
  }, [messages, streamingMessage])

  // Render the chat widget
  return (
    <ErrorBoundary fallback={<div>Something went wrong with the chat widget. Please refresh the page.</div>}>
      <DashboardCard
        title={showTitle ? "Chat" : undefined}
        description={showTitle ? "Ask questions about your documents" : undefined}
        isLoading={isLoadingConversations}
        className="flex flex-col"
        style={{ height }}
      >
        <div className="flex flex-col h-full">
          {/* Active conversation view */}
          {activeConversationId ? (
            <div className="flex flex-col h-full">
              {/* Conversation header */}
              <div className="flex items-center justify-between mb-3 px-1">
                {showConversationList && (
                  <button
                    onClick={handleBackToList}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back
                  </button>
                )}
                <h3 className="text-sm font-medium flex-1 truncate text-center">
                  {truncateText(activeConversationTitle, 30)}
                </h3>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                    aria-label="Conversation settings"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Settings dropdown */}
                {showSettings && (
                  <div className="absolute right-4 mt-8 z-10 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                      <button
                        onClick={handleDeleteConversation}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                        role="menuitem"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Conversation
                      </button>
                      <button
                        onClick={() => {
                          setShowSettings(false)
                          // Add export functionality here
                          addToast("Export feature coming soon", "info")
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        role="menuitem"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Conversation
                      </button>
                      <button
                        onClick={() => {
                          setShowSettings(false)
                          // Add search functionality here
                          addToast("Search feature coming soon", "info")
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        role="menuitem"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search in Conversation
                      </button>
                    </div>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="absolute top-1 right-1 p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                      aria-label="Close settings"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Messages container with virtualization */}
              <div className="flex-1 bg-gray-50 rounded-md p-3 mb-3 overflow-hidden">
                {allMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <div className="bg-white rounded-full p-3 mb-4 shadow-sm">
                      <BookOpen className="h-6 w-6 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Start a new conversation</h3>
                    <p className="text-sm text-gray-500 mb-6 max-w-md">
                      Ask questions about your documents or start a conversation about any topic.
                    </p>
                    <div className="text-xs text-gray-500 bg-white px-4 py-2 rounded-md shadow-sm">
                      <p className="font-medium mb-1">Current mode: {mode}</p>
                      <p>
                        {mode === "chat"
                          ? "Conversational mode for general questions"
                          : mode === "qa"
                            ? "Precise question answering with citations"
                            : "In-depth analysis of document content"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Virtuoso
                    ref={virtuosoRef}
                    style={{ height: "100%" }}
                    data={allMessages}
                    itemContent={(index, msg) => (
                      <Message
                        key={msg.id}
                        message={msg}
                        isLatest={index === allMessages.length - 1}
                        onRetry={retryLastMessage}
                      />
                    )}
                    components={{
                      Footer: () => (isTyping ? <TypingIndicator /> : null),
                    }}
                    initialTopMostItemIndex={allMessages.length - 1}
                    followOutput="smooth"
                  />
                )}
              </div>

              {/* Input area */}
              <ChatInput
                message={message}
                setMessage={setMessage}
                onSendMessage={handleSendMessage}
                isTyping={isTyping}
                mode={mode}
                onChangeMode={handleChangeMode}
                allowModeSelection={allowModeSelection}
              />
            </div>
          ) : (
            // Conversation list view
            <ConversationList
              conversations={safeConversations}
              activeConversationId={activeConversationId}
              onSelectConversation={handleOpenChat}
              onNewChat={handleNewChat}
              isLoading={isLoadingConversations}
              errorMessage={errorMessage}
              onRetry={handleRetry}
            />
          )}
        </div>
      </DashboardCard>
    </ErrorBoundary>
  )
}
