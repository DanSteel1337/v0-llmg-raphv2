/**
 * Conversations Hook
 *
 * Custom hook for managing chat conversations.
 *
 * Dependencies:
 * - @/hooks/use-api for API interaction
 * - @/services/client-api-service for backend communication
 * - @/types for conversation types
 */

"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useApi } from "@/hooks/use-api"
import {
  fetchConversations,
  createConversation as apiCreateConversation,
  updateConversation as apiUpdateConversation,
  deleteConversation as apiDeleteConversation,
} from "@/services/client-api-service"
import type { Conversation, ConversationMode, ConversationSettings } from "@/types"

// Local storage keys
const STORAGE_KEYS = {
  CONVERSATIONS: "rag_conversations_",
  ACTIVE_CONVERSATION: "rag_active_conversation_",
  PINNED_CONVERSATIONS: "rag_pinned_conversations_",
  ARCHIVED_CONVERSATIONS: "rag_archived_conversations_",
  CONVERSATION_SETTINGS: "rag_conversation_settings_",
}

// Default conversation settings
const DEFAULT_SETTINGS: ConversationSettings = {
  mode: "chat",
  showReferences: true,
  contextWindow: 10,
  temperature: 0.7,
}

// Search options type
export interface ConversationSearchOptions {
  query?: string
  startDate?: Date
  endDate?: Date
  mode?: ConversationMode
  includeArchived?: boolean
  sortBy?: "updated" | "created" | "title" | "messageCount"
  sortDirection?: "asc" | "desc"
}

// Conversation stats type
export interface ConversationStats {
  totalConversations: number
  activeConversations: number
  archivedConversations: number
  pinnedConversations: number
  totalMessages: number
  averageMessagesPerConversation: number
  mostActiveConversation?: Conversation
}

/**
 * Enhanced hook for managing conversations
 * @param userId User ID for the current user
 * @param initialConversationId Optional initial conversation ID to select
 * @returns Conversation state and methods
 */
export function useConversations(userId: string, initialConversationId?: string) {
  // State for conversations and active conversation
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(initialConversationId)
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>([])
  const [archivedConversationIds, setArchivedConversationIds] = useState<string[]>([])
  const [conversationSettings, setConversationSettings] = useState<Record<string, ConversationSettings>>({})
  const [searchOptions, setSearchOptions] = useState<ConversationSearchOptions>({
    sortBy: "updated",
    sortDirection: "desc",
    includeArchived: false,
  })
  const [localConversations, setLocalConversations] = useState<Conversation[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [syncError, setSyncError] = useState<Error | null>(null)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Ensure userId is valid before making any requests
  const safeUserId = userId || ""

  // Wrap the fetchConversations call with useCallback
  const fetchConversationsCallback = useCallback(() => {
    if (!safeUserId) {
      console.log("No userId provided, skipping fetchConversations")
      return Promise.resolve([])
    }

    console.log(`Fetching conversations for user: ${safeUserId}`)
    return fetchConversations(safeUserId)
  }, [safeUserId])

  // Fetch conversations from API
  const {
    data: apiConversations,
    isLoading,
    error,
    execute: loadConversations,
  } = useApi<Conversation[], []>(fetchConversationsCallback)

  /**
   * Initialize local storage data
   */
  const initializeLocalStorage = useCallback(() => {
    if (!safeUserId || typeof window === "undefined") return

    try {
      // Load pinned conversations
      const storedPinned = localStorage.getItem(`${STORAGE_KEYS.PINNED_CONVERSATIONS}${safeUserId}`)
      if (storedPinned) {
        setPinnedConversationIds(JSON.parse(storedPinned))
      }

      // Load archived conversations
      const storedArchived = localStorage.getItem(`${STORAGE_KEYS.ARCHIVED_CONVERSATIONS}${safeUserId}`)
      if (storedArchived) {
        setArchivedConversationIds(JSON.parse(storedArchived))
      }

      // Load conversation settings
      const storedSettings = localStorage.getItem(`${STORAGE_KEYS.CONVERSATION_SETTINGS}${safeUserId}`)
      if (storedSettings) {
        setConversationSettings(JSON.parse(storedSettings))
      }

      // Load active conversation
      const storedActiveId = localStorage.getItem(`${STORAGE_KEYS.ACTIVE_CONVERSATION}${safeUserId}`)
      if (storedActiveId && !initialConversationId) {
        setActiveConversationId(storedActiveId)
      }

      // Load cached conversations
      const storedConversations = localStorage.getItem(`${STORAGE_KEYS.CONVERSATIONS}${safeUserId}`)
      if (storedConversations) {
        setLocalConversations(JSON.parse(storedConversations))
      }

      setIsInitialized(true)
    } catch (err) {
      console.error("Error initializing conversation data from localStorage:", err)
      // Continue without local data if there's an error
      setIsInitialized(true)
    }
  }, [safeUserId, initialConversationId])

  /**
   * Save data to local storage
   */
  const saveToLocalStorage = useCallback(
    (key: string, data: any) => {
      if (!safeUserId || typeof window === "undefined") return

      try {
        localStorage.setItem(`${key}${safeUserId}`, JSON.stringify(data))
      } catch (err) {
        console.error(`Error saving to localStorage (${key}):`, err)
      }
    },
    [safeUserId],
  )

  /**
   * Sync local conversations with API data
   */
  const syncConversations = useCallback(
    (apiData: Conversation[] | undefined) => {
      if (!apiData || !Array.isArray(apiData)) return

      // Merge API data with local data, preferring API data but preserving local-only conversations
      const mergedConversations = [...apiData]

      // Add any local-only conversations (those with temp_ prefix that haven't synced yet)
      localConversations.forEach((localConv) => {
        if (localConv.id.startsWith("temp_") && !apiData.some((apiConv) => apiConv.id === localConv.id)) {
          mergedConversations.push(localConv)
        }
      })

      setLocalConversations(mergedConversations)
      saveToLocalStorage(STORAGE_KEYS.CONVERSATIONS, mergedConversations)
    },
    [localConversations, saveToLocalStorage],
  )

  /**
   * Create a new conversation with proper error handling and optimistic updates
   * @param title Title for the conversation
   * @param mode Optional conversation mode
   * @returns The created conversation
   */
  const createConversation = async (title: string, mode: ConversationMode = "chat") => {
    if (!safeUserId) {
      throw new Error("User ID is required to create a conversation")
    }

    if (!title || typeof title !== "string" || title.trim() === "") {
      throw new Error("Conversation title cannot be empty")
    }

    // Create a temporary ID for optimistic updates
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()

    // Create temporary conversation for optimistic update
    const tempConversation: Conversation = {
      id: tempId,
      user_id: safeUserId,
      title: title.trim(),
      created_at: now,
      updated_at: now,
      message_count: 0,
      // Add additional fields for enhanced functionality
      last_message: null,
      is_syncing: true,
    }

    try {
      // Update local state immediately for optimistic UI
      setLocalConversations((prev) => [tempConversation, ...prev])
      setActiveConversationId(tempId)
      saveToLocalStorage(STORAGE_KEYS.ACTIVE_CONVERSATION, tempId)

      // Save initial settings for this conversation
      const newSettings = { ...DEFAULT_SETTINGS, mode }
      setConversationSettings((prev) => ({ ...prev, [tempId]: newSettings }))
      saveToLocalStorage(STORAGE_KEYS.CONVERSATION_SETTINGS, {
        ...conversationSettings,
        [tempId]: newSettings,
      })

      // Call API to create conversation
      console.log(`Creating conversation with title: ${title}`)
      const apiConversation = await apiCreateConversation(safeUserId, title)

      if (!apiConversation?.id) {
        throw new Error("Failed to create conversation: No conversation ID returned")
      }

      console.log(`Conversation created with ID: ${apiConversation.id}`)

      // Update local state with the real conversation ID
      setLocalConversations((prev) =>
        prev.map((conv) => (conv.id === tempId ? { ...apiConversation, is_syncing: false } : conv)),
      )

      // Update active conversation ID
      setActiveConversationId(apiConversation.id)
      saveToLocalStorage(STORAGE_KEYS.ACTIVE_CONVERSATION, apiConversation.id)

      // Update settings with the real ID
      const updatedSettings = { ...conversationSettings }
      updatedSettings[apiConversation.id] = updatedSettings[tempId]
      delete updatedSettings[tempId]
      setConversationSettings(updatedSettings)
      saveToLocalStorage(STORAGE_KEYS.CONVERSATION_SETTINGS, updatedSettings)

      // Refresh the conversation list
      await loadConversations()

      return apiConversation
    } catch (error) {
      console.error(`Error creating conversation:`, error)

      // Mark the temporary conversation as failed
      setLocalConversations((prev) =>
        prev.map((conv) => (conv.id === tempId ? { ...conv, is_syncing: false, error: true } : conv)),
      )

      throw error
    }
  }

  /**
   * Update an existing conversation
   * @param id Conversation ID
   * @param updates Updates to apply
   * @returns The updated conversation
   */
  const updateConversation = async (id: string, updates: Partial<Conversation>) => {
    if (!id) {
      throw new Error("Conversation ID is required")
    }

    // Find the conversation to update
    const conversation = localConversations.find((c) => c.id === id)
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`)
    }

    try {
      // Update local state immediately for optimistic UI
      const updatedConversation = { ...conversation, ...updates, updated_at: new Date().toISOString() }
      setLocalConversations((prev) => prev.map((c) => (c.id === id ? updatedConversation : c)))
      saveToLocalStorage(
        STORAGE_KEYS.CONVERSATIONS,
        localConversations.map((c) => (c.id === id ? updatedConversation : c)),
      )

      // Call API to update conversation
      if (!id.startsWith("temp_")) {
        await apiUpdateConversation(id, updates)
      }

      return updatedConversation
    } catch (error) {
      console.error(`Error updating conversation:`, error)

      // Revert local state on error
      setLocalConversations((prev) => prev.map((c) => (c.id === id ? { ...c, error: true } : c)))

      // Retry logic for API failures
      if (retryCount < 2) {
        setRetryCount((prev) => prev + 1)
        console.log(`Retrying update conversation (${retryCount + 1}/2)...`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return updateConversation(id, updates)
      }

      throw error
    } finally {
      setRetryCount(0)
    }
  }

  /**
   * Delete a conversation
   * @param id Conversation ID
   * @returns True if deleted successfully
   */
  const deleteConversation = async (id: string) => {
    if (!id) {
      throw new Error("Conversation ID is required")
    }

    try {
      // Update local state immediately for optimistic UI
      setLocalConversations((prev) => prev.filter((c) => c.id !== id))
      saveToLocalStorage(
        STORAGE_KEYS.CONVERSATIONS,
        localConversations.filter((c) => c.id !== id),
      )

      // Remove from pinned if present
      if (pinnedConversationIds.includes(id)) {
        const updatedPinned = pinnedConversationIds.filter((pinId) => pinId !== id)
        setPinnedConversationIds(updatedPinned)
        saveToLocalStorage(STORAGE_KEYS.PINNED_CONVERSATIONS, updatedPinned)
      }

      // Remove from archived if present
      if (archivedConversationIds.includes(id)) {
        const updatedArchived = archivedConversationIds.filter((archId) => archId !== id)
        setArchivedConversationIds(updatedArchived)
        saveToLocalStorage(STORAGE_KEYS.ARCHIVED_CONVERSATIONS, updatedArchived)
      }

      // Remove settings
      const updatedSettings = { ...conversationSettings }
      delete updatedSettings[id]
      setConversationSettings(updatedSettings)
      saveToLocalStorage(STORAGE_KEYS.CONVERSATION_SETTINGS, updatedSettings)

      // If this was the active conversation, clear it
      if (activeConversationId === id) {
        setActiveConversationId(undefined)
        localStorage.removeItem(`${STORAGE_KEYS.ACTIVE_CONVERSATION}${safeUserId}`)
      }

      // Call API to delete conversation (only for non-temporary conversations)
      if (!id.startsWith("temp_")) {
        await apiDeleteConversation(id)
      }

      return true
    } catch (error) {
      console.error(`Error deleting conversation:`, error)

      // Retry logic for API failures
      if (retryCount < 2) {
        setRetryCount((prev) => prev + 1)
        console.log(`Retrying delete conversation (${retryCount + 1}/2)...`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return deleteConversation(id)
      }

      throw error
    } finally {
      setRetryCount(0)
    }
  }

  /**
   * Select a conversation as active
   * @param id Conversation ID
   */
  const selectConversation = useCallback(
    (id: string | undefined) => {
      setActiveConversationId(id)
      if (id) {
        saveToLocalStorage(STORAGE_KEYS.ACTIVE_CONVERSATION, id)

        // Update the conversation's last accessed time
        setLocalConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, last_accessed: new Date().toISOString() } : c)),
        )
      } else {
        localStorage.removeItem(`${STORAGE_KEYS.ACTIVE_CONVERSATION}${safeUserId}`)
      }
    },
    [safeUserId, saveToLocalStorage],
  )

  /**
   * Toggle pinned status for a conversation
   * @param id Conversation ID
   * @returns New pinned status
   */
  const togglePinned = useCallback(
    (id: string) => {
      if (!id) return false

      const isPinned = pinnedConversationIds.includes(id)
      let updatedPinned: string[]

      if (isPinned) {
        updatedPinned = pinnedConversationIds.filter((pinId) => pinId !== id)
      } else {
        updatedPinned = [...pinnedConversationIds, id]
      }

      setPinnedConversationIds(updatedPinned)
      saveToLocalStorage(STORAGE_KEYS.PINNED_CONVERSATIONS, updatedPinned)

      return !isPinned
    },
    [pinnedConversationIds, saveToLocalStorage],
  )

  /**
   * Toggle archived status for a conversation
   * @param id Conversation ID
   * @returns New archived status
   */
  const toggleArchived = useCallback(
    (id: string) => {
      if (!id) return false

      const isArchived = archivedConversationIds.includes(id)
      let updatedArchived: string[]

      if (isArchived) {
        updatedArchived = archivedConversationIds.filter((archId) => archId !== id)
      } else {
        updatedArchived = [...archivedConversationIds, id]
      }

      setArchivedConversationIds(updatedArchived)
      saveToLocalStorage(STORAGE_KEYS.ARCHIVED_CONVERSATIONS, updatedArchived)

      return !isArchived
    },
    [archivedConversationIds, saveToLocalStorage],
  )

  /**
   * Update settings for a conversation
   * @param id Conversation ID
   * @param settings Settings to update
   */
  const updateConversationSettings = useCallback(
    (id: string, settings: Partial<ConversationSettings>) => {
      if (!id) return

      const currentSettings = conversationSettings[id] || DEFAULT_SETTINGS
      const updatedSettings = { ...currentSettings, ...settings }

      setConversationSettings((prev) => ({ ...prev, [id]: updatedSettings }))
      saveToLocalStorage(STORAGE_KEYS.CONVERSATION_SETTINGS, {
        ...conversationSettings,
        [id]: updatedSettings,
      })
    },
    [conversationSettings, saveToLocalStorage],
  )

  /**
   * Search conversations based on provided options
   * @param options Search options
   * @returns Filtered conversations
   */
  const searchConversations = useCallback(
    (options: ConversationSearchOptions = {}) => {
      // Merge with current search options
      const mergedOptions = { ...searchOptions, ...options }
      setSearchOptions(mergedOptions)

      let filtered = [...localConversations]

      // Filter by query
      if (mergedOptions.query) {
        const query = mergedOptions.query.toLowerCase()
        filtered = filtered.filter(
          (c) => c.title.toLowerCase().includes(query) || c.last_message?.toLowerCase().includes(query),
        )
      }

      // Filter by date range
      if (mergedOptions.startDate) {
        filtered = filtered.filter((c) => new Date(c.created_at) >= mergedOptions.startDate!)
      }

      if (mergedOptions.endDate) {
        filtered = filtered.filter((c) => new Date(c.created_at) <= mergedOptions.endDate!)
      }

      // Filter by mode
      if (mergedOptions.mode) {
        filtered = filtered.filter((c) => {
          const settings = conversationSettings[c.id]
          return settings?.mode === mergedOptions.mode
        })
      }

      // Filter archived
      if (!mergedOptions.includeArchived) {
        filtered = filtered.filter((c) => !archivedConversationIds.includes(c.id))
      }

      // Sort results
      const { sortBy = "updated", sortDirection = "desc" } = mergedOptions

      filtered.sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
          case "updated":
            comparison = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            break
          case "created":
            comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            break
          case "title":
            comparison = a.title.localeCompare(b.title)
            break
          case "messageCount":
            comparison = (b.message_count || 0) - (a.message_count || 0)
            break
        }

        return sortDirection === "asc" ? -comparison : comparison
      })

      return filtered
    },
    [localConversations, searchOptions, archivedConversationIds, conversationSettings],
  )

  /**
   * Export conversations to a file
   * @param format Export format
   * @param ids Optional conversation IDs to export (all if not specified)
   */
  const exportConversations = useCallback(
    (format: "json" | "csv" = "json", ids?: string[]) => {
      const conversationsToExport = ids ? localConversations.filter((c) => ids.includes(c.id)) : localConversations

      if (conversationsToExport.length === 0) {
        throw new Error("No conversations to export")
      }

      let content: string
      let filename: string
      let mimeType: string

      if (format === "json") {
        content = JSON.stringify(conversationsToExport, null, 2)
        filename = `conversations_export_${new Date().toISOString().split("T")[0]}.json`
        mimeType = "application/json"
      } else {
        // CSV format
        const headers = "id,title,created_at,updated_at,message_count\n"
        const rows = conversationsToExport
          .map((c) => `${c.id},"${c.title.replace(/"/g, '""')}",${c.created_at},${c.updated_at},${c.message_count}`)
          .join("\n")
        content = headers + rows
        filename = `conversations_export_${new Date().toISOString().split("T")[0]}.csv`
        mimeType = "text/csv"
      }

      // Create and download the file
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      return conversationsToExport.length
    },
    [localConversations],
  )

  /**
   * Import conversations from a file
   * @param file File to import
   * @returns Number of imported conversations
   */
  const importConversations = useCallback(
    async (file: File) => {
      if (!file) {
        throw new Error("No file provided")
      }

      try {
        const text = await file.text()
        let importedConversations: Conversation[]

        if (file.name.endsWith(".json")) {
          importedConversations = JSON.parse(text)

          if (!Array.isArray(importedConversations)) {
            throw new Error("Invalid JSON format: expected an array of conversations")
          }
        } else if (file.name.endsWith(".csv")) {
          // Basic CSV parsing
          const lines = text.split("\n")
          const headers = lines[0].split(",")

          importedConversations = lines.slice(1).map((line) => {
            const values = line.split(",")
            const conversation: any = {}

            headers.forEach((header, index) => {
              conversation[header] = values[index]
            })

            return conversation as Conversation
          })
        } else {
          throw new Error("Unsupported file format. Please use .json or .csv")
        }

        // Validate imported conversations
        const validConversations = importedConversations.filter(
          (c) => c && c.id && c.title && c.created_at && c.updated_at,
        )

        if (validConversations.length === 0) {
          throw new Error("No valid conversations found in the import file")
        }

        // Add imported conversations to local state
        const now = new Date().toISOString()
        const conversationsWithImportMeta = validConversations.map((c) => ({
          ...c,
          user_id: safeUserId,
          imported_at: now,
          is_imported: true,
        }))

        setLocalConversations((prev) => [...conversationsWithImportMeta, ...prev])
        saveToLocalStorage(STORAGE_KEYS.CONVERSATIONS, [...conversationsWithImportMeta, ...localConversations])

        return validConversations.length
      } catch (error) {
        console.error("Error importing conversations:", error)
        throw new Error(`Failed to import conversations: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    },
    [safeUserId, localConversations, saveToLocalStorage],
  )

  /**
   * Calculate conversation statistics
   * @returns Conversation statistics
   */
  const getConversationStats = useCallback((): ConversationStats => {
    const totalConversations = localConversations.length
    const activeConversations = localConversations.filter((c) => !archivedConversationIds.includes(c.id)).length
    const archivedConversations = archivedConversationIds.length
    const pinnedConversations = pinnedConversationIds.length

    const totalMessages = localConversations.reduce((sum, conv) => sum + (conv.message_count || 0), 0)
    const averageMessagesPerConversation = totalConversations > 0 ? totalMessages / totalConversations : 0

    // Find most active conversation
    let mostActiveConversation: Conversation | undefined
    let maxMessages = 0

    localConversations.forEach((conv) => {
      if ((conv.message_count || 0) > maxMessages) {
        maxMessages = conv.message_count || 0
        mostActiveConversation = conv
      }
    })

    return {
      totalConversations,
      activeConversations,
      archivedConversations,
      pinnedConversations,
      totalMessages,
      averageMessagesPerConversation,
      mostActiveConversation,
    }
  }, [localConversations, archivedConversationIds, pinnedConversationIds])

  /**
   * Schedule periodic sync with API
   */
  const scheduleSync = useCallback(() => {
    // Clear any existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // Schedule new sync after 5 minutes
    syncTimeoutRef.current = setTimeout(
      () => {
        loadConversations().catch((err) => {
          console.error("Error during scheduled sync:", err)
          setSyncError(err instanceof Error ? err : new Error(String(err)))
        })
      },
      5 * 60 * 1000,
    ) // 5 minutes
  }, [loadConversations])

  // Initialize local storage data on mount
  useEffect(() => {
    initializeLocalStorage()
  }, [initializeLocalStorage])

  // Sync API conversations with local state
  useEffect(() => {
    if (apiConversations && isInitialized) {
      syncConversations(apiConversations)
      scheduleSync()
    }

    // Cleanup sync timeout on unmount
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [apiConversations, isInitialized, syncConversations, scheduleSync])

  // Load conversations on mount or when userId changes
  useEffect(() => {
    if (safeUserId && isInitialized) {
      loadConversations()
    }
  }, [safeUserId, isInitialized, loadConversations])

  // Prepare filtered and organized conversations
  const organizedConversations = useMemo(() => {
    // Apply current search options
    const filtered = searchConversations(searchOptions)

    // Organize into categories
    return {
      pinned: filtered.filter((c) => pinnedConversationIds.includes(c.id)),
      active: filtered.filter((c) => !pinnedConversationIds.includes(c.id) && !archivedConversationIds.includes(c.id)),
      archived: filtered.filter((c) => archivedConversationIds.includes(c.id)),
    }
  }, [localConversations, pinnedConversationIds, archivedConversationIds, searchConversations, searchOptions])

  // Get the active conversation object
  const activeConversation = useMemo(
    () => (activeConversationId ? localConversations.find((c) => c.id === activeConversationId) : undefined),
    [activeConversationId, localConversations],
  )

  // Get settings for the active conversation
  const activeConversationSettings = useMemo(
    () => (activeConversationId ? conversationSettings[activeConversationId] || DEFAULT_SETTINGS : DEFAULT_SETTINGS),
    [activeConversationId, conversationSettings],
  )

  return {
    // Conversation data
    conversations: localConversations,
    organizedConversations,
    activeConversation,
    activeConversationId,
    activeConversationSettings,

    // Loading and error states
    isLoading,
    error,
    syncError,

    // Conversation actions
    createConversation,
    updateConversation,
    deleteConversation,
    selectConversation,
    togglePinned,
    toggleArchived,
    updateConversationSettings,

    // Search and organization
    searchConversations,
    searchOptions,
    setSearchOptions,

    // Import/Export
    exportConversations,
    importConversations,

    // Analytics
    getConversationStats,

    // Refresh
    refreshConversations: loadConversations,

    // Status helpers
    isPinned: (id: string) => pinnedConversationIds.includes(id),
    isArchived: (id: string) => archivedConversationIds.includes(id),
  }
}
