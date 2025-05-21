/**
 * Navigation Component
 *
 * Main navigation component for the application.
 */

"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Search, FileText, MessageSquare, BarChart2, Settings, Menu, X, LogOut } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

interface NavigationProps {
  className?: string
}

export function Navigation({ className = "" }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { logout, user } = useAuth()

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const closeMenu = () => {
    setIsOpen(false)
  }

  const handleSignOut = async () => {
    await logout()
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/search", label: "Search", icon: Search },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/settings", label: "Settings", icon: Settings },
  ]

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(`${href}/`)
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-4 right-4 z-50 p-2 rounded-md bg-white shadow-md"
        onClick={toggleMenu}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Navigation sidebar */}
      <nav
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${className}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-4 border-b">
            <h1 className="text-xl font-bold">RAG System</h1>
            {user && <p className="text-sm text-gray-500 truncate">{user.email}</p>}
          </div>

          {/* Nav items */}
          <ul className="flex-1 py-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 ${
                      active ? "bg-blue-50 text-blue-600 font-medium border-r-4 border-blue-600" : ""
                    }`}
                    onClick={closeMenu}
                  >
                    <Icon size={20} className={`mr-3 ${active ? "text-blue-600" : "text-gray-500"}`} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Footer/Sign out */}
          <div className="p-4 border-t">
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              <LogOut size={20} className="mr-3 text-gray-500" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Overlay for mobile */}
      {isOpen && <div className="md:hidden fixed inset-0 z-30 bg-black bg-opacity-50" onClick={closeMenu} />}
    </>
  )
}
