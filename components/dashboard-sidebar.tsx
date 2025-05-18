"use client"

import { BarChart, FileText, MessageSquare, Search, Settings } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

interface DashboardSidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export function DashboardSidebar({ activeTab, setActiveTab }: DashboardSidebarProps) {
  const menuItems = [
    {
      id: "documents",
      label: "Documents",
      icon: FileText,
    },
    {
      id: "search",
      label: "Search",
      icon: Search,
    },
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="h-8 w-8 rounded-full bg-primary" />
          <div className="font-semibold">Vector-RAG</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton isActive={activeTab === item.id} onClick={() => setActiveTab(item.id)}>
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-4 py-2 text-xs text-muted-foreground">Version 1.0.0</div>
      </SidebarFooter>
    </Sidebar>
  )
}
