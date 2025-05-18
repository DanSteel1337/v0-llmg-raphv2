"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, FileText, Copy, Check, Download, Settings, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useRagChat } from "@/hooks/use-rag-chat"
import { useAnalytics } from "@/hooks/use-analytics"

interface ChatInterfaceProps {
  userId: string
}

export function ChatInterface({ userId }: ChatInterfaceProps) {
  const { messages, isTyping, error, sendMessage, clearChat } = useRagChat(userId)
  const { logEvent } = useAnalytics(userId)

  const [input, setInput] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [responseLength, setResponseLength] = useState(2) // 1-3 scale
  const [citationStyle, setCitationStyle] = useState("inline")
  const [streamResponse, setStreamResponse] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!input.trim()) return

    try {
      await sendMessage(input, {
        responseLength,
        citationStyle,
      })

      // Log analytics event
      logEvent("chat_message", {
        message_length: input.length,
        response_settings: {
          responseLength,
          citationStyle,
        },
      })

      setInput("")
    } catch (err) {
      console.error("Error sending message:", err)
    }
  }

  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)

    // Log analytics event
    logEvent("copy_message", { message_id: id })
  }

  const handleExportChat = () => {
    // Create a text representation of the chat
    const chatContent = messages
      .filter((msg) => msg.id !== "welcome")
      .map((msg) => `${msg.role === "user" ? "You" : "Assistant"}: ${msg.content}`)
      .join("\n\n")

    const blob = new Blob([chatContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `chat-export-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Log analytics event
    logEvent("export_chat", {
      message_count: messages.length - 1, // Exclude welcome message
    })
  }

  const handleClearChat = () => {
    clearChat()

    // Log analytics event
    logEvent("clear_chat", {})
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Chat Interface</h2>
          <p className="text-muted-foreground">Ask questions about your documents and get AI-powered answers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportChat}>
            <Download className="mr-2 h-4 w-4" />
            Export Chat
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearChat}>
            <RefreshCw className="mr-2 h-4 w-4" />
            New Chat
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Chat Settings</h4>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="response-length">Response Length</Label>
                    <span className="text-xs text-muted-foreground">
                      {responseLength === 1 ? "Concise" : responseLength === 2 ? "Balanced" : "Detailed"}
                    </span>
                  </div>
                  <Slider
                    id="response-length"
                    min={1}
                    max={3}
                    step={1}
                    value={[responseLength]}
                    onValueChange={(value) => setResponseLength(value[0])}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="citation-style">Citation Style</Label>
                  <Select value={citationStyle} onValueChange={setCitationStyle}>
                    <SelectTrigger id="citation-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inline">Inline Citations</SelectItem>
                      <SelectItem value="footnote">Footnote Citations</SelectItem>
                      <SelectItem value="endnote">Endnote Citations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="stream-response">Stream Response</Label>
                  <Switch id="stream-response" checked={streamResponse} onCheckedChange={setStreamResponse} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Card className="flex-1">
        <CardContent className="flex h-full flex-col p-4">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 pt-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex max-w-[80%] flex-col rounded-lg p-4 ${
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {message.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      <span className="text-xs font-medium">{message.role === "assistant" ? "Assistant" : "You"}</span>
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="whitespace-pre-wrap">
                        {message.content}
                        {message.isLoading && (
                          <span className="ml-1 inline-block h-4 w-4 animate-pulse rounded-full bg-current opacity-50"></span>
                        )}
                      </div>

                      {message.citations && message.citations.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <Separator className="my-2" />
                          <div className="text-xs font-medium">Sources:</div>
                          {message.citations.map((citation) => (
                            <div
                              key={citation.id}
                              className="flex items-start gap-1 rounded bg-background/50 p-1 text-xs"
                            >
                              <FileText className="mt-0.5 h-3 w-3 flex-shrink-0" />
                              <div>
                                <span className="font-medium">{citation.document}</span>
                                {citation.page && <span> (p. {citation.page})</span>}
                                <p className="mt-0.5 text-muted-foreground">"{citation.text}"</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {message.role === "assistant" && message.content && (
                      <div className="mt-2 flex justify-end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleCopyMessage(message.id, message.content)}
                              >
                                {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {copiedId === message.id ? "Copied!" : "Copy message"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
              placeholder="Ask a question about your documents..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isTyping}>
              <Send className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-5 text-xs">
                {responseLength === 1 ? "Concise" : responseLength === 2 ? "Balanced" : "Detailed"} Responses
              </Badge>
              <Badge variant="outline" className="h-5 text-xs">
                {citationStyle === "inline" ? "Inline" : citationStyle === "footnote" ? "Footnote" : "Endnote"}{" "}
                Citations
              </Badge>
            </div>
            <div>{isTyping ? "Assistant is typing..." : "Ask me anything about your documents"}</div>
          </div>

          {error && (
            <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
              Error: {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
