"use client"

import type React from "react"

import { useState } from "react"
import { Search, Filter, SortDesc, Calendar, FileText, Clock, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { useSearch } from "@/hooks/use-search"
import { useAnalytics } from "@/hooks/use-analytics"

interface SearchInterfaceProps {
  userId: string
}

export function SearchInterface({ userId }: SearchInterfaceProps) {
  const { results, isSearching, error, search, clearResults } = useSearch(userId)
  const { logEvent } = useAnalytics(userId)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState("semantic")
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<string[]>(["PDF", "DOCX", "TXT"])
  const [sortBy, setSortBy] = useState("relevance")
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!searchQuery.trim()) return

    try {
      await search(searchQuery, {
        type: searchType as "semantic" | "keyword" | "hybrid",
        documentTypes: selectedDocumentTypes,
        sortBy,
        dateRange,
      })

      // Log analytics event
      logEvent("search", {
        query: searchQuery,
        type: searchType,
        filters: {
          documentTypes: selectedDocumentTypes,
          sortBy,
          dateRange,
        },
      })
    } catch (err) {
      console.error("Error performing search:", err)
    }
  }

  const handleDocumentTypeChange = (type: string) => {
    setSelectedDocumentTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  const clearSearch = () => {
    setSearchQuery("")
    clearResults()
  }

  const handleExportResults = () => {
    // Create a text representation of the results
    const resultsText = results
      .map(
        (result) =>
          `Title: ${result.title}\n` +
          `Content: ${result.content}\n` +
          `Document: ${result.documentName}\n` +
          `Type: ${result.documentType}\n` +
          `Date: ${result.date}\n` +
          `Relevance: ${(result.relevance * 100).toFixed(0)}%\n\n` +
          `Highlights:\n${result.highlights.join("\n")}\n\n` +
          `-------------------------------------------\n\n`,
      )
      .join("")

    // Create a blob and download
    const blob = new Blob([resultsText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `search-results-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Log analytics event
    logEvent("export_search_results", {
      query: searchQuery,
      result_count: results.length,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Search Interface</h2>
        <p className="text-muted-foreground">Search across your documents using semantic or keyword-based search.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Advanced Search</CardTitle>
          <CardDescription>Find information across your document library using AI-powered search.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search your documents..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Tabs defaultValue="semantic" value={searchType} onValueChange={setSearchType} className="w-[250px]">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="semantic">Semantic</TabsTrigger>
                  <TabsTrigger value="keyword">Keyword</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filters</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h4 className="font-medium">Document Types</h4>
                    <div className="space-y-2">
                      {["PDF", "DOCX", "TXT", "CSV", "XLSX"].map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${type}`}
                            checked={selectedDocumentTypes.includes(type)}
                            onCheckedChange={() => handleDocumentTypeChange(type)}
                          />
                          <Label htmlFor={`type-${type}`}>{type}</Label>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <h4 className="font-medium">Date Range</h4>
                    <div className="space-y-2">
                      <CalendarComponent
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        className="rounded-md border"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 w-[150px] gap-1">
                  <SortDesc className="h-3.5 w-3.5" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>

              {searchQuery && (
                <Button variant="ghost" size="sm" className="h-8" onClick={clearSearch}>
                  Clear
                </Button>
              )}

              {selectedDocumentTypes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedDocumentTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="h-6">
                      {type}
                    </Badge>
                  ))}
                </div>
              )}

              {(dateRange.from || dateRange.to) && (
                <Badge variant="secondary" className="h-6 gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {dateRange.from ? dateRange.from.toLocaleDateString() : "Any"}
                    {" to "}
                    {dateRange.to ? dateRange.to.toLocaleDateString() : "Any"}
                  </span>
                </Badge>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {isSearching ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="text-sm text-muted-foreground">Searching documents...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <div className="text-center">
            <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
            <p className="text-xs text-red-500 dark:text-red-300">Please try again or contact support</p>
          </div>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Search Results ({results.length})</h3>
            <Button variant="outline" size="sm" onClick={handleExportResults}>
              <Download className="mr-2 h-4 w-4" />
              Export Results
            </Button>
          </div>

          <ScrollArea className="h-[500px] rounded-md border p-4">
            <div className="space-y-6">
              {results.map((result) => (
                <div key={result.id} className="space-y-2">
                  <h4 className="text-lg font-medium">{result.title}</h4>
                  <p className="text-sm text-muted-foreground">{result.content}</p>

                  <div className="space-y-1 rounded-md bg-muted p-2">
                    {result.highlights.map((highlight, i) => (
                      <p key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: highlight }} />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{result.documentName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{result.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Relevance: {(result.relevance * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  <Separator />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : searchQuery ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
            <p className="text-xs text-muted-foreground">Try adjusting your search terms or filters</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
