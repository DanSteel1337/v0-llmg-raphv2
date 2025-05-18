"use client"

import { useState, useEffect } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DocumentManagement } from "@/components/document-management"
import { SearchInterface } from "@/components/search-interface"
import { ChatInterface } from "@/components/chat-interface"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { SettingsConfiguration } from "@/components/settings-configuration"
import { SystemStatus } from "@/components/system-status"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ModeToggle } from "@/components/mode-toggle"
import { useAuth } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("documents")
  const { user, isLoading } = useAuth()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/login"
    }
  }, [user, isLoading])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <h1 className="text-xl font-semibold">Vector-RAG Dashboard</h1>
          <div className="flex items-center gap-4">
            <SystemStatus />
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="hidden">
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="documents" className="mt-0">
              <DocumentManagement userId={user.id} />
            </TabsContent>
            <TabsContent value="search" className="mt-0">
              <SearchInterface userId={user.id} />
            </TabsContent>
            <TabsContent value="chat" className="mt-0">
              <ChatInterface userId={user.id} />
            </TabsContent>
            <TabsContent value="analytics" className="mt-0">
              <AnalyticsDashboard userId={user.id} />
            </TabsContent>
            <TabsContent value="settings" className="mt-0">
              <SettingsConfiguration />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
