/**
 * Navigation Component
 *
 * A responsive navigation bar for the dashboard in the serverless RAG system.
 * Provides navigation links, user profile information, and authentication controls.
 *
 * Features:
 * - Responsive design for mobile and desktop
 * - Collapsible menu for mobile
 * - Authentication integration
 * - Active link highlighting
 * - User profile display
 *
 * @module components/ui/navigation
 */

"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { useToast } from "@/components/ui/toast"
import {
  Menu,
  X,
  Home,
  FileText,
  MessageSquare,
  Search,
  BarChart2,
  Settings,
  LogOut,
  User,
  Database,
  HelpCircle,
} from "lucide-react"

/**
 * Navigation component props
 */
interface NavigationProps {
  className?: string
}

/**
 * Navigation link item interface
 */
interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  requiresAuth: boolean
  children?: NavItem[]
}

/**
 * Navigation Component
 *
 * @param props - Component props
 * @returns Navigation component
 */
export function Navigation({ className = "" }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const { user, isAuthenticated, signOut } = useAuth()
  const { toast } = useToast()

  // Navigation items configuration
  const navItems: NavItem[] = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
      requiresAuth: true,
    },
    {
      name: "Documents",
      href: "/dashboard/documents",
      icon: FileText,
      requiresAuth: true,
    },
    {
      name: "Chat",
      href: "/dashboard/chat",
      icon: MessageSquare,
      requiresAuth: true,
    },
    {
      name: "Search",
      href: "/dashboard/search",
      icon: Search,
      requiresAuth: true,
    },
    {
      name: "Analytics",
      href: "/dashboard/analytics",
      icon: BarChart2,
      requiresAuth: true,
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      requiresAuth: true,
      children: [
        {
          name: "Profile",
          href: "/dashboard/settings/profile",
          icon: User,
          requiresAuth: true,
        },
        {
          name: "Database",
          href: "/dashboard/settings/database",
          icon: Database,
          requiresAuth: true,
        },
      ],
    },
    {
      name: "Help",
      href: "/dashboard/help",
      icon: HelpCircle,
      requiresAuth: true,
    },
  ]

  /**
   * Toggle mobile menu
   */
  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  /**
   * Close mobile menu
   */
  const closeMenu = useCallback(() => {
    setIsOpen(false)
  }, [])

  /**
   * Handle sign out
   */
  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
        variant: "success",
      })
    } catch (error) {
      console.error("Sign out error:", error)
      toast({
        title: "Sign out failed",
        description: "There was a problem signing you out. Please try again.",
        variant: "error",
      })
    }
  }, [signOut, toast])

  /**
   * Check if a link is active
   */
  const isLinkActive = useCallback(
    (href: string) => {
      if (href === "/dashboard" && pathname === "/dashboard") {
        return true
      }
      return pathname?.startsWith(href) && href !== "/dashboard"
    },
    [pathname],
  )

  /**
   * Handle window resize
   */
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setIsOpen(false)
      }
    }

    // Initial check
    handleResize()

    // Add event listener
    window.addEventListener("resize", handleResize)

    // Clean up
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  /**
   * Handle escape key to close menu
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  /**
   * Prevent body scroll when menu is open
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  /**
   * Render navigation link
   */
  const renderNavLink = (item: NavItem, index: number) => {
    const isActive = isLinkActive(item.href)
    const Icon = item.icon

    return (
      <li key={index} className="mb-1">
        <Link
          href={item.href}
          className={`flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
            isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          onClick={closeMenu}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon className="mr-3 h-5 w-5" aria-hidden="true" />
          <span>{item.name}</span>
        </Link>
        {item.children && (
          <ul className="pl-10 mt-1 space-y-1">
            {item.children.map((child, childIndex) => (
              <li key={`${index}-${childIndex}`}>
                <Link
                  href={child.href}
                  className={`flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                    isLinkActive(child.href)
                      ? "bg-gray-800 text-white"
                      : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }`}
                  onClick={closeMenu}
                  aria-current={isLinkActive(child.href) ? "page" : undefined}
                >
                  <child.icon className="mr-3 h-4 w-4" aria-hidden="true" />
                  <span>{child.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <ErrorBoundary>
      <nav className={`bg-gray-900 text-white ${className}`} role="navigation" aria-label="Main navigation">
        {/* Mobile menu button */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center">
              <span className="text-xl font-bold">RAG System</span>
            </Link>
          </div>
          <button
            type="button"
            className="text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white p-2"
            onClick={toggleMenu}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
            {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden fixed inset-0 z-40 bg-gray-900 transition-transform transform ease-in-out duration-300 ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          id="mobile-menu"
          aria-hidden={!isOpen}
        >
          <div className="pt-20 pb-3 px-2 space-y-1 sm:px-3">
            <div className="flex flex-col items-center mb-6">
              {user ? (
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full bg-gray-700 flex items-center justify-center text-xl font-semibold mb-2">
                    {user.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="text-sm font-medium text-white truncate max-w-[200px]">{user.email}</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full bg-gray-700 flex items-center justify-center mb-2">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-medium text-white">Guest</div>
                </div>
              )}
            </div>

            <ul className="space-y-2">
              {navItems.filter((item) => !item.requiresAuth || isAuthenticated()).map(renderNavLink)}
            </ul>

            {isAuthenticated() && (
              <div className="pt-4 mt-6 border-t border-gray-800">
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                >
                  <LogOut className="mr-3 h-5 w-5" aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-gray-900">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center h-16 px-4 border-b border-gray-800">
              <Link href="/dashboard" className="flex items-center">
                <span className="text-xl font-bold">RAG System</span>
              </Link>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
              <nav className="flex-1 px-2 space-y-1">
                <ul className="space-y-2">
                  {navItems.filter((item) => !item.requiresAuth || isAuthenticated()).map(renderNavLink)}
                </ul>
              </nav>
            </div>
            <div className="flex-shrink-0 p-4 border-t border-gray-800">
              {user ? (
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center text-lg font-semibold">
                      {user.email?.[0]?.toUpperCase() || "U"}
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-white truncate max-w-[140px]">{user.email}</div>
                    <button
                      onClick={handleSignOut}
                      className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
                      <User className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-white">Guest</div>
                    <Link href="/login" className="text-xs text-gray-400 hover:text-white transition-colors">
                      Sign in
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Overlay for mobile menu */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30" aria-hidden="true" onClick={closeMenu} />
      )}
    </ErrorBoundary>
  )
}

export default Navigation
