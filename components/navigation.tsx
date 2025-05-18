"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Search, MessageSquare, BarChart2, Settings, Menu, X, LogOut, User } from "lucide-react"
import { signOut } from "@/services/auth-service"
import { useToast } from "./toast"

interface NavigationItem {
  name: string
  href: string
  icon: React.ElementType
}

const navigationItems: NavigationItem[] = [
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Search", href: "/search", icon: Search },
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Analytics", href: "/analytics", icon: BarChart2 },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Navigation() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { addToast } = useToast()

  const handleSignOut = async () => {
    try {
      await signOut()
      addToast("Successfully signed out", "success")
    } catch (error) {
      addToast("Failed to sign out", "error")
    }
  }

  return (
    <>
      {/* Desktop navigation */}
      <nav className="hidden md:flex flex-col h-screen w-64 bg-gray-900 text-white p-4">
        <div className="flex items-center mb-8 px-2">
          <span className="text-xl font-bold">Vector RAG</span>
        </div>

        <div className="flex flex-col flex-1">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-4 py-3 rounded-md transition-colors ${
                      isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-auto border-t border-gray-700 pt-4">
          <Link
            href="/profile"
            className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors"
          >
            <User className="mr-3 h-5 w-5" />
            Profile
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors w-full"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign out
          </button>
        </div>
      </nav>

      {/* Mobile navigation */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="fixed top-4 right-4 z-50 p-2 rounded-md bg-gray-900 text-white"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {isMobileMenuOpen && (
          <nav className="fixed inset-0 z-40 bg-gray-900 text-white p-4">
            <div className="flex items-center mb-8 px-2">
              <span className="text-xl font-bold">Vector RAG</span>
            </div>

            <ul className="space-y-2">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-4 py-3 rounded-md transition-colors ${
                        isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="mt-8 border-t border-gray-700 pt-4">
              <Link
                href="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors"
              >
                <User className="mr-3 h-5 w-5" />
                Profile
              </Link>
              <button
                onClick={() => {
                  handleSignOut()
                  setIsMobileMenuOpen(false)
                }}
                className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors w-full"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign out
              </button>
            </div>
          </nav>
        )}
      </div>
    </>
  )
}
