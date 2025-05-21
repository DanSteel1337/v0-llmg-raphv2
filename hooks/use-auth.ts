/**
 * Simplified Authentication Hook
 *
 * Provides minimal authentication functionality using Supabase client.
 *
 * @module hooks/use-auth
 * @client This hook is intended for client-side use only
 */

"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { User } from "@supabase/supabase-js"

// Simple auth context type
interface AuthContextType {
  user: User | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
  getAuthHeader: () => Promise<string | null>
}

// Create authentication context
const AuthContext = createContext<AuthContextType | null>(null)

// Authentication provider props
interface AuthProviderProps {
  children: ReactNode
}

/**
 * Authentication Provider Component
 *
 * Provides authentication state and functions to children components
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClientComponentClient()

  // Initialize authentication state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get session from Supabase
        const {
          data: { session },
        } = await supabase.auth.getSession()

        // Set user if session exists
        if (session) {
          setUser(session.user)
        }
      } catch (err) {
        console.error("Auth initialization error:", err)
        setError("Failed to initialize authentication")
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setUser(session.user)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
      }
    })

    // Clean up subscription
    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  /**
   * Sign in with email and password
   */
  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setError(error.message)
          return false
        }

        if (data.user) {
          setUser(data.user)
          return true
        }

        return false
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to sign in"
        setError(errorMessage)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [supabase],
  )

  /**
   * Sign out the current user
   */
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true)

    try {
      await supabase.auth.signOut()
      setUser(null)
      router.push("/login")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign out"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, router])

  /**
   * Clear authentication errors
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Get authorization header for API requests
   */
  const getAuthHeader = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ? `Bearer ${data.session.access_token}` : null
    } catch (err) {
      console.error("Error getting auth header:", err)
      return null
    }
  }, [supabase])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      user,
      isLoading,
      error,
      login,
      logout,
      clearError,
      getAuthHeader,
    }),
    [user, isLoading, error, login, logout, clearError, getAuthHeader],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

/**
 * Authentication Hook
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}

/**
 * Protected Route Guard
 */
export function withAuth<P extends object>(Component: React.ComponentType<P>): React.FC<P> {
  const ProtectedRoute: React.FC<P> = (props) => {
    const { user, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!isLoading && !user) {
        router.push("/login")
      }
    }, [user, isLoading, router])

    if (isLoading) {
      return <div className="flex items-center justify-center h-screen">Loading...</div>
    }

    if (!user) {
      return null
    }

    return <Component {...props} />
  }

  return ProtectedRoute
}

export default useAuth
