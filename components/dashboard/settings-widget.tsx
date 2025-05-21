/**
 * Settings Widget Component
 *
 * A dashboard widget for configuring the serverless RAG system settings and user preferences.
 * Provides interfaces for system configuration, user profile management, and application preferences.
 *
 * Features:
 * - System configuration settings (embedding, search, chunking)
 * - User profile management
 * - UI preferences
 * - Settings persistence via localStorage
 * - Import/export functionality
 *
 * @module components/dashboard/settings-widget
 */

"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  User,
  Search,
  FileText,
  Database,
  Code,
  Save,
  RefreshCw,
  Download,
  Upload,
  Info,
  Moon,
  Sun,
  Laptop,
  Trash2,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react"

import { DashboardCard } from "@/components/ui/dashboard-card"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ErrorBoundary } from "@/components/ui/error-boundary"

// Default settings
const DEFAULT_SETTINGS = {
  system: {
    embedding: {
      model: "text-embedding-3-large",
      dimensions: 3072,
      batchSize: 5,
      retryAttempts: 3,
      cacheEnabled: true,
      cacheTTL: 86400, // 24 hours in seconds
    },
    search: {
      relevanceThreshold: 0.75,
      maxResults: 10,
      includeMetadata: true,
      hybridSearch: false,
      reranking: false,
    },
    chunking: {
      strategy: "fixed",
      chunkSize: 1000,
      chunkOverlap: 200,
      preserveParagraphs: true,
      includeMetadata: true,
    },
    api: {
      rateLimit: 10,
      timeout: 30000,
      retryEnabled: true,
      maxRetries: 3,
      backoffFactor: 1.5,
    },
  },
  ui: {
    theme: "system",
    density: "comfortable",
    animations: true,
    sidebarCollapsed: false,
    resultsPerPage: 10,
    dateFormat: "yyyy-MM-dd",
    timeFormat: "24h",
  },
  notifications: {
    documentProcessingComplete: true,
    documentProcessingError: true,
    searchComplete: false,
    systemUpdates: true,
    emailNotifications: false,
  },
}

// Types for settings
interface EmbeddingSettings {
  model: string
  dimensions: number
  batchSize: number
  retryAttempts: number
  cacheEnabled: boolean
  cacheTTL: number
}

interface SearchSettings {
  relevanceThreshold: number
  maxResults: number
  includeMetadata: boolean
  hybridSearch: boolean
  reranking: boolean
}

interface ChunkingSettings {
  strategy: string
  chunkSize: number
  chunkOverlap: number
  preserveParagraphs: boolean
  includeMetadata: boolean
}

interface ApiSettings {
  rateLimit: number
  timeout: number
  retryEnabled: boolean
  maxRetries: number
  backoffFactor: number
}

interface UISettings {
  theme: string
  density: string
  animations: boolean
  sidebarCollapsed: boolean
  resultsPerPage: number
  dateFormat: string
  timeFormat: string
}

interface NotificationSettings {
  documentProcessingComplete: boolean
  documentProcessingError: boolean
  searchComplete: boolean
  systemUpdates: boolean
  emailNotifications: boolean
}

interface SystemSettings {
  embedding: EmbeddingSettings
  search: SearchSettings
  chunking: ChunkingSettings
  api: ApiSettings
}

interface Settings {
  system: SystemSettings
  ui: UISettings
  notifications: NotificationSettings
}

interface SettingsWidgetProps {
  userId: string
}

/**
 * Settings Widget Component
 */
export function SettingsWidget({ userId }: SettingsWidgetProps) {
  // Hooks
  const { toast } = useToast()
  const { user, refreshSession } = useAuth()

  // State
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [activeTab, setActiveTab] = useState("system")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Mock API key for demonstration
  const apiKey = useMemo(() => "sk_rag_" + userId.substring(0, 16), [userId])

  // Load settings from localStorage on component mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem(`rag-settings-${userId}`)
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings)
          setSettings(parsedSettings)
        }
        setIsLoading(false)
      } catch (error) {
        console.error("Error loading settings:", error)
        toast({
          title: "Error loading settings",
          description: "Your settings could not be loaded. Default settings applied.",
          variant: "destructive",
        })
        setSettings(DEFAULT_SETTINGS)
        setIsLoading(false)
      }
    }

    // Simulate loading delay for demonstration
    setTimeout(loadSettings, 500)
  }, [userId, toast])

  // Save settings to localStorage
  const saveSettings = useCallback(async () => {
    setIsSaving(true)
    try {
      localStorage.setItem(`rag-settings-${userId}`, JSON.stringify(settings))

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 800))

      toast({
        title: "Settings saved",
        description: "Your settings have been saved successfully.",
      })
      setHasChanges(false)
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error saving settings",
        description: "Your settings could not be saved. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [settings, userId, toast])

  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    setHasChanges(true)
    setConfirmResetOpen(false)
    toast({
      title: "Settings reset",
      description: "All settings have been reset to defaults. Click Save to apply.",
    })
  }, [toast])

  // Update settings
  const updateSettings = useCallback((path: string[], value: any) => {
    setSettings((prevSettings) => {
      const newSettings = JSON.parse(JSON.stringify(prevSettings))
      let current = newSettings

      // Navigate to the nested property
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]]
      }

      // Update the value
      current[path[path.length - 1]] = value

      return newSettings
    })
    setHasChanges(true)
  }, [])

  // Export settings as JSON
  const exportSettings = useCallback(() => {
    try {
      const dataStr = JSON.stringify(settings, null, 2)
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`

      const exportFileDefaultName = `rag-settings-${new Date().toISOString().split("T")[0]}.json`

      const linkElement = document.createElement("a")
      linkElement.setAttribute("href", dataUri)
      linkElement.setAttribute("download", exportFileDefaultName)
      linkElement.click()

      toast({
        title: "Settings exported",
        description: "Your settings have been exported as JSON.",
      })
    } catch (error) {
      console.error("Error exporting settings:", error)
      toast({
        title: "Error exporting settings",
        description: "Your settings could not be exported. Please try again.",
        variant: "destructive",
      })
    }
  }, [settings, toast])

  // Import settings from JSON
  const importSettings = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string)

          // Basic validation
          if (!importedSettings.system || !importedSettings.ui || !importedSettings.notifications) {
            throw new Error("Invalid settings format")
          }

          setSettings(importedSettings)
          setHasChanges(true)

          toast({
            title: "Settings imported",
            description: "Your settings have been imported successfully. Click Save to apply.",
          })
        } catch (error) {
          console.error("Error importing settings:", error)
          toast({
            title: "Error importing settings",
            description: "The selected file contains invalid settings. Please try again.",
            variant: "destructive",
          })
        }
      }
      reader.readAsText(file)

      // Reset the input
      event.target.value = ""
    },
    [toast],
  )

  // Copy API key to clipboard
  const copyApiKey = useCallback(() => {
    navigator.clipboard.writeText(apiKey)
    toast({
      title: "API key copied",
      description: "Your API key has been copied to clipboard.",
    })
  }, [apiKey, toast])

  // Regenerate API key
  const regenerateApiKey = useCallback(() => {
    // In a real application, this would call an API to regenerate the key
    toast({
      title: "API key regenerated",
      description: "Your new API key has been generated and copied to clipboard.",
    })
  }, [toast])

  // Filter settings based on search query
  const filteredSettings = useMemo(() => {
    if (!searchQuery) return null

    const query = searchQuery.toLowerCase()
    const results: Array<{ section: string; category: string; setting: string; path: string[] }> = []

    // Helper function to search recursively through settings
    const searchSettings = (obj: any, path: string[] = [], section = "", category = "") => {
      for (const key in obj) {
        const currentPath = [...path, key]
        const settingName = key.replace(/([A-Z])/g, " $1").toLowerCase()

        if (typeof obj[key] === "object" && obj[key] !== null) {
          // If this is a category or subcategory
          if (path.length === 0) {
            searchSettings(obj[key], currentPath, key, "")
          } else if (path.length === 1) {
            searchSettings(obj[key], currentPath, section, key)
          } else {
            searchSettings(obj[key], currentPath, section, category)
          }
        } else if (settingName.includes(query) || category.toLowerCase().includes(query)) {
          // If this is a setting that matches the query
          results.push({
            section,
            category,
            setting: key,
            path: currentPath,
          })
        }
      }
    }

    searchSettings(settings)
    return results
  }, [searchQuery, settings])

  // Render loading state
  if (isLoading) {
    return (
      <DashboardCard title="Settings" description="Loading your preferences..." isLoading={true}>
        <div className="h-64"></div>
      </DashboardCard>
    )
  }

  return (
    <ErrorBoundary>
      <DashboardCard
        title="Settings"
        description="Configure system settings and preferences"
        actions={
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmResetOpen(true)} disabled={isSaving}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Reset
            </Button>
            <Button
              variant={hasChanges ? "default" : "outline"}
              size="sm"
              onClick={saveSettings}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-1 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search settings..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredSettings && filteredSettings.length > 0 ? (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Search Results</h3>
            <div className="bg-gray-50 rounded-md p-4 space-y-3">
              {filteredSettings.map((result, index) => (
                <div key={index} className="flex items-start">
                  <Badge className="mr-2 mt-0.5">{result.section}</Badge>
                  <div>
                    <p className="text-sm font-medium">
                      {result.category} &gt; {result.setting.replace(/([A-Z])/g, " $1")}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-xs"
                      onClick={() => {
                        setSearchQuery("")
                        setActiveTab(result.section.toLowerCase())
                      }}
                    >
                      Go to setting
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : searchQuery ? (
          <div className="mb-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No results found</AlertTitle>
              <AlertDescription>No settings match your search query. Try using different keywords.</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="ui">UI & Display</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* System Settings Tab */}
          <TabsContent value="system">
            <div className="space-y-6">
              {/* Embedding Settings */}
              <Accordion type="single" collapsible defaultValue="embedding">
                <AccordionItem value="embedding">
                  <AccordionTrigger className="text-base font-medium">
                    <div className="flex items-center">
                      <Code className="mr-2 h-5 w-5 text-blue-500" />
                      Embedding Settings
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="embedding-model">Embedding Model</Label>
                          <Select
                            value={settings.system.embedding.model}
                            onValueChange={(value) => updateSettings(["system", "embedding", "model"], value)}
                          >
                            <SelectTrigger id="embedding-model">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text-embedding-3-large">text-embedding-3-large (3072 dims)</SelectItem>
                              <SelectItem value="text-embedding-3-small">text-embedding-3-small (1536 dims)</SelectItem>
                              <SelectItem value="text-embedding-ada-002">text-embedding-ada-002 (1536 dims)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="embedding-dimensions">Vector Dimensions</Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              id="embedding-dimensions"
                              type="number"
                              value={settings.system.embedding.dimensions}
                              onChange={(e) =>
                                updateSettings(["system", "embedding", "dimensions"], Number.parseInt(e.target.value))
                              }
                              min={768}
                              max={4096}
                              step={1}
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Must match the selected embedding model</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="embedding-batch-size">Batch Size</Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              id="embedding-batch-size"
                              type="number"
                              value={settings.system.embedding.batchSize}
                              onChange={(e) =>
                                updateSettings(["system", "embedding", "batchSize"], Number.parseInt(e.target.value))
                              }
                              min={1}
                              max={20}
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Number of chunks to process in a single API call</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="embedding-retry-attempts">Retry Attempts</Label>
                          <Input
                            id="embedding-retry-attempts"
                            type="number"
                            value={settings.system.embedding.retryAttempts}
                            onChange={(e) =>
                              updateSettings(["system", "embedding", "retryAttempts"], Number.parseInt(e.target.value))
                            }
                            min={0}
                            max={10}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="embedding-cache-enabled">Enable Embedding Cache</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-gray-400" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Cache embeddings to reduce API calls and improve performance</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Switch
                          id="embedding-cache-enabled"
                          checked={settings.system.embedding.cacheEnabled}
                          onCheckedChange={(checked) =>
                            updateSettings(["system", "embedding", "cacheEnabled"], checked)
                          }
                        />
                      </div>

                      {settings.system.embedding.cacheEnabled && (
                        <div className="space-y-2">
                          <Label htmlFor="embedding-cache-ttl">Cache TTL (seconds)</Label>
                          <Input
                            id="embedding-cache-ttl"
                            type="number"
                            value={settings.system.embedding.cacheTTL}
                            onChange={(e) =>
                              updateSettings(["system", "embedding", "cacheTTL"], Number.parseInt(e.target.value))
                            }
                            min={60}
                            max={2592000} // 30 days
                          />
                          <p className="text-xs text-gray-500">
                            {settings.system.embedding.cacheTTL === 86400
                              ? "Default: 24 hours"
                              : `${Math.floor(settings.system.embedding.cacheTTL / 3600)} hours ${Math.floor((settings.system.embedding.cacheTTL % 3600) / 60)} minutes`}
                          </p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Search Settings */}
                <AccordionItem value="search">
                  <AccordionTrigger className="text-base font-medium">
                    <div className="flex items-center">
                      <Search className="mr-2 h-5 w-5 text-green-500" />
                      Search Settings
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="search-relevance-threshold">Relevance Threshold</Label>
                          <span className="text-sm text-gray-500">
                            {settings.system.search.relevanceThreshold.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          id="search-relevance-threshold"
                          min={0}
                          max={1}
                          step={0.01}
                          value={[settings.system.search.relevanceThreshold]}
                          onValueChange={(value) =>
                            updateSettings(["system", "search", "relevanceThreshold"], value[0])
                          }
                        />
                        <p className="text-xs text-gray-500">Higher values return more relevant but fewer results</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="search-max-results">Maximum Results</Label>
                        <Input
                          id="search-max-results"
                          type="number"
                          value={settings.system.search.maxResults}
                          onChange={(e) =>
                            updateSettings(["system", "search", "maxResults"], Number.parseInt(e.target.value))
                          }
                          min={1}
                          max={100}
                        />
                        <p className="text-xs text-gray-500">Maximum number of results to return per search</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="search-include-metadata">Include Metadata</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-gray-400" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Include document metadata in search results</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Switch
                          id="search-include-metadata"
                          checked={settings.system.search.includeMetadata}
                          onCheckedChange={(checked) =>
                            updateSettings(["system", "search", "includeMetadata"], checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="search-hybrid-search">Enable Hybrid Search</Label>
                          <Badge variant="outline">Beta</Badge>
                        </div>
                        <Switch
                          id="search-hybrid-search"
                          checked={settings.system.search.hybridSearch}
                          onCheckedChange={(checked) => updateSettings(["system", "search", "hybridSearch"], checked)}
                        />
                      </div>

                      {settings.system.search.hybridSearch && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Label htmlFor="search-reranking">Enable Result Reranking</Label>
                            <Badge variant="outline">Beta</Badge>
                          </div>
                          <Switch
                            id="search-reranking"
                            checked={settings.system.search.reranking}
                            onCheckedChange={(checked) => updateSettings(["system", "search", "reranking"], checked)}
                          />
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Chunking Settings */}
                <AccordionItem value="chunking">
                  <AccordionTrigger className="text-base font-medium">
                    <div className="flex items-center">
                      <FileText className="mr-2 h-5 w-5 text-yellow-500" />
                      Chunking Settings
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="chunking-strategy">Chunking Strategy</Label>
                        <Select
                          value={settings.system.chunking.strategy}
                          onValueChange={(value) => updateSettings(["system", "chunking", "strategy"], value)}
                        >
                          <SelectTrigger id="chunking-strategy">
                            <SelectValue placeholder="Select strategy" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed Size</SelectItem>
                            <SelectItem value="paragraph">Paragraph</SelectItem>
                            <SelectItem value="semantic">Semantic (Beta)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="chunking-size">Chunk Size (characters)</Label>
                        <Input
                          id="chunking-size"
                          type="number"
                          value={settings.system.chunking.chunkSize}
                          onChange={(e) =>
                            updateSettings(["system", "chunking", "chunkSize"], Number.parseInt(e.target.value))
                          }
                          min={100}
                          max={8000}
                          step={100}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="chunking-overlap">Chunk Overlap (characters)</Label>
                        <Input
                          id="chunking-overlap"
                          type="number"
                          value={settings.system.chunking.chunkOverlap}
                          onChange={(e) =>
                            updateSettings(["system", "chunking", "chunkOverlap"], Number.parseInt(e.target.value))
                          }
                          min={0}
                          max={settings.system.chunking.chunkSize / 2}
                          step={10}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="chunking-preserve-paragraphs">Preserve Paragraphs</Label>
                        <Switch
                          id="chunking-preserve-paragraphs"
                          checked={settings.system.chunking.preserveParagraphs}
                          onCheckedChange={(checked) =>
                            updateSettings(["system", "chunking", "preserveParagraphs"], checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="chunking-include-metadata">Include Metadata in Chunks</Label>
                        <Switch
                          id="chunking-include-metadata"
                          checked={settings.system.chunking.includeMetadata}
                          onCheckedChange={(checked) =>
                            updateSettings(["system", "chunking", "includeMetadata"], checked)
                          }
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* API Settings */}
                <AccordionItem value="api">
                  <AccordionTrigger className="text-base font-medium">
                    <div className="flex items-center">
                      <Database className="mr-2 h-5 w-5 text-purple-500" />
                      API Settings
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="api-rate-limit">Rate Limit (requests per minute)</Label>
                        <Input
                          id="api-rate-limit"
                          type="number"
                          value={settings.system.api.rateLimit}
                          onChange={(e) =>
                            updateSettings(["system", "api", "rateLimit"], Number.parseInt(e.target.value))
                          }
                          min={1}
                          max={100}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="api-timeout">Timeout (milliseconds)</Label>
                        <Input
                          id="api-timeout"
                          type="number"
                          value={settings.system.api.timeout}
                          onChange={(e) =>
                            updateSettings(["system", "api", "timeout"], Number.parseInt(e.target.value))
                          }
                          min={1000}
                          max={120000}
                          step={1000}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="api-retry-enabled">Enable Automatic Retries</Label>
                        <Switch
                          id="api-retry-enabled"
                          checked={settings.system.api.retryEnabled}
                          onCheckedChange={(checked) => updateSettings(["system", "api", "retryEnabled"], checked)}
                        />
                      </div>

                      {settings.system.api.retryEnabled && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="api-max-retries">Maximum Retries</Label>
                            <Input
                              id="api-max-retries"
                              type="number"
                              value={settings.system.api.maxRetries}
                              onChange={(e) =>
                                updateSettings(["system", "api", "maxRetries"], Number.parseInt(e.target.value))
                              }
                              min={1}
                              max={10}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="api-backoff-factor">Backoff Factor</Label>
                            <Input
                              id="api-backoff-factor"
                              type="number"
                              value={settings.system.api.backoffFactor}
                              onChange={(e) =>
                                updateSettings(["system", "api", "backoffFactor"], Number.parseFloat(e.target.value))
                              }
                              min={1}
                              max={5}
                              step={0.1}
                            />
                            <p className="text-xs text-gray-500">Multiplier for exponential backoff between retries</p>
                          </div>
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>

          {/* Profile Settings Tab */}
          <TabsContent value="profile">
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 rounded-full p-3">
                    <User className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">{user?.email || "User"}</h3>
                    <p className="text-sm text-gray-500">Account ID: {userId.substring(0, 8)}...</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-medium">Account Information</h3>

                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email Address</Label>
                  <Input id="profile-email" type="email" value={user?.email || ""} disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-name">Display Name</Label>
                  <Input
                    id="profile-name"
                    type="text"
                    placeholder="Enter your display name"
                    onChange={() => setHasChanges(true)}
                  />
                </div>

                <div className="pt-2">
                  <Button variant="outline">Change Password</Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-base font-medium">API Access</h3>

                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <div className="flex">
                    <div className="relative flex-grow">
                      <Input
                        id="api-key"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        className="pr-10"
                        readOnly
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button variant="outline" className="ml-2" onClick={copyApiKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Use this key to authenticate API requests</p>
                </div>

                <div className="pt-2">
                  <Button variant="outline" onClick={regenerateApiKey}>
                    Regenerate API Key
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* UI Settings Tab */}
          <TabsContent value="ui">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-base font-medium">Theme & Appearance</h3>

                <div className="space-y-2">
                  <Label>Theme</Label>
                  <RadioGroup
                    value={settings.ui.theme}
                    onValueChange={(value) => updateSettings(["ui", "theme"], value)}
                    className="flex space-x-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="light" id="theme-light" />
                      <Label htmlFor="theme-light" className="flex items-center">
                        <Sun className="mr-1 h-4 w-4" />
                        Light
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dark" id="theme-dark" />
                      <Label htmlFor="theme-dark" className="flex items-center">
                        <Moon className="mr-1 h-4 w-4" />
                        Dark
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="system" id="theme-system" />
                      <Label htmlFor="theme-system" className="flex items-center">
                        <Laptop className="mr-1 h-4 w-4" />
                        System
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Density</Label>
                  <RadioGroup
                    value={settings.ui.density}
                    onValueChange={(value) => updateSettings(["ui", "density"], value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="comfortable" id="density-comfortable" />
                      <Label htmlFor="density-comfortable">Comfortable</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="compact" id="density-compact" />
                      <Label htmlFor="density-compact">Compact</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="ui-animations">Enable Animations</Label>
                  <Switch
                    id="ui-animations"
                    checked={settings.ui.animations}
                    onCheckedChange={(checked) => updateSettings(["ui", "animations"], checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="ui-sidebar-collapsed">Collapse Sidebar by Default</Label>
                  <Switch
                    id="ui-sidebar-collapsed"
                    checked={settings.ui.sidebarCollapsed}
                    onCheckedChange={(checked) => updateSettings(["ui", "sidebarCollapsed"], checked)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-base font-medium">Display Settings</h3>

                <div className="space-y-2">
                  <Label htmlFor="ui-results-per-page">Results Per Page</Label>
                  <Select
                    value={settings.ui.resultsPerPage.toString()}
                    onValueChange={(value) => updateSettings(["ui", "resultsPerPage"], Number.parseInt(value))}
                  >
                    <SelectTrigger id="ui-results-per-page">
                      <SelectValue placeholder="Select number" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ui-date-format">Date Format</Label>
                  <Select
                    value={settings.ui.dateFormat}
                    onValueChange={(value) => updateSettings(["ui", "dateFormat"], value)}
                  >
                    <SelectTrigger id="ui-date-format">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yyyy-MM-dd">2023-01-31</SelectItem>
                      <SelectItem value="MM/dd/yyyy">01/31/2023</SelectItem>
                      <SelectItem value="dd/MM/yyyy">31/01/2023</SelectItem>
                      <SelectItem value="MMM d, yyyy">Jan 31, 2023</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ui-time-format">Time Format</Label>
                  <Select
                    value={settings.ui.timeFormat}
                    onValueChange={(value) => updateSettings(["ui", "timeFormat"], value)}
                  >
                    <SelectTrigger id="ui-time-format">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-hour (1:30 PM)</SelectItem>
                      <SelectItem value="24h">24-hour (13:30)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-base font-medium">In-App Notifications</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-doc-complete">Document Processing Complete</Label>
                    <Switch
                      id="notify-doc-complete"
                      checked={settings.notifications.documentProcessingComplete}
                      onCheckedChange={(checked) =>
                        updateSettings(["notifications", "documentProcessingComplete"], checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-doc-error">Document Processing Errors</Label>
                    <Switch
                      id="notify-doc-error"
                      checked={settings.notifications.documentProcessingError}
                      onCheckedChange={(checked) =>
                        updateSettings(["notifications", "documentProcessingError"], checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-search-complete">Search Complete</Label>
                    <Switch
                      id="notify-search-complete"
                      checked={settings.notifications.searchComplete}
                      onCheckedChange={(checked) => updateSettings(["notifications", "searchComplete"], checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify-system-updates">System Updates</Label>
                    <Switch
                      id="notify-system-updates"
                      checked={settings.notifications.systemUpdates}
                      onCheckedChange={(checked) => updateSettings(["notifications", "systemUpdates"], checked)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-base font-medium">Email Notifications</h3>

                <div className="flex items-center justify-between">
                  <Label htmlFor="notify-email">Enable Email Notifications</Label>
                  <Switch
                    id="notify-email"
                    checked={settings.notifications.emailNotifications}
                    onCheckedChange={(checked) => updateSettings(["notifications", "emailNotifications"], checked)}
                  />
                </div>

                {settings.notifications.emailNotifications && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm">
                      Email notifications will be sent to: <strong>{user?.email}</strong>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      You can change your email address in your profile settings
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-base font-medium">Settings Management</h3>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportSettings}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Settings
                  </Button>

                  <div className="relative">
                    <Button variant="outline">
                      <Upload className="mr-2 h-4 w-4" />
                      Import Settings
                    </Button>
                    <input
                      type="file"
                      accept=".json"
                      onChange={importSettings}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>

                  <Button variant="outline" onClick={() => setConfirmResetOpen(true)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset to Defaults
                  </Button>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Settings are stored locally</AlertTitle>
                  <AlertDescription>
                    Your settings are stored in your browser's localStorage. Clearing your browser data will reset all
                    settings.
                  </AlertDescription>
                </Alert>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-base font-medium">Danger Zone</h3>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Delete All Data</h4>
                  <p className="text-sm text-red-700 mb-4">
                    This will permanently delete all your documents, conversations, and settings. This action cannot be
                    undone.
                  </p>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All Data
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DashboardCard>

      {/* Reset Confirmation Dialog */}
      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Settings</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset all settings to their default values? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={resetSettings}>
              Reset Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  )
}
