/**
 * Settings Widget Component
 *
 * A dashboard widget for quick access to settings and user preferences.
 *
 * Dependencies:
 * - @/components/ui/dashboard-card for layout
 */

"use client"

import { useState } from "react"
import { User, Key, Bell } from "lucide-react"
import { DashboardCard } from "@/components/ui/dashboard-card"
import { useToast } from "@/components/toast"

interface SettingsWidgetProps {
  userId: string
}

export function SettingsWidget({ userId }: SettingsWidgetProps) {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const settingsOptions = [
    {
      name: "Profile",
      description: "Manage your account information",
      icon: User,
      id: "profile",
    },
    {
      name: "API Keys",
      description: "Manage API access",
      icon: Key,
      id: "api-keys",
    },
    {
      name: "Notifications",
      description: "Configure notification preferences",
      icon: Bell,
      id: "notifications",
    },
  ]

  const handleSettingClick = (id: string) => {
    setActiveTab(id === activeTab ? null : id)
    addToast(`Opened ${id} settings`, "info")
  }

  return (
    <DashboardCard title="Settings" description="Quick access to settings">
      <ul className="divide-y divide-gray-200">
        {settingsOptions.map((option) => (
          <li key={option.name}>
            <button
              onClick={() => handleSettingClick(option.id)}
              className="w-full flex items-center py-3 hover:bg-gray-50 px-2 rounded-md"
            >
              <div className="p-2 rounded-md bg-gray-100 mr-3">
                <option.icon className="h-4 w-4 text-gray-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{option.name}</p>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>
            </button>

            {activeTab === option.id && (
              <div className="mt-2 p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-600">
                  {option.name} settings would be displayed here. This is a placeholder for the actual settings
                  interface.
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </DashboardCard>
  )
}
