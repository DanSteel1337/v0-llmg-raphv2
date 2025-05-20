/**
 * Authentication Hook
 *
 * Custom hook for handling user authentication state and operations.
 * Provides functions for sign in, sign out, and session management.
 *
 * Dependencies:
 * - @/lib/supabase-client for authentication API
 * - @/components/toast for notifications
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Session, User, AuthError } from "@supabase/supabase-js"
import { useToast } from "@/components/toast"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<AuthError | null>(null)
  const router = useRouter()
  const { addToast } = useToast()
  const supabase = createClientComponentClient()

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        setLoading(true)
        console.log("Auth state check: Initializing...")

        // Get session from Supabase
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Auth session error:", error)
          setAuthError(error)
          addToast(`Authentication error: ${error.message}`, "error")
          return
        }

        if (data?.session) {
          console.log("Auth state check: Session found")
          setSession(data.session)
          setUser(data.session.user)
        } else {
          console.log("Auth state check: Auth session missing!")
        }
      } catch (err) {
        console.error("Auth initialization error:", err)
        addToast("Failed to initialize authentication", "error")
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change:", event)
      setSession(session)
      setUser(session?.user ?? null)

      // Handle auth events
      if (event === "SIGNED_IN") {
        router.refresh()
      } else if (event === "SIGNED_OUT") {
        router.push("/login")
      }
    })

    // Clean up listener
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [supabase, router, addToast])

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      setAuthError(null)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setAuthError(error)
        addToast(`Sign in failed: ${error.message}`, "error")
        return { success: false, error }
      }

      if (data?.session) {
        setSession(data.session)
        setUser(data.session.user)
        addToast("Signed in successfully", "success")
        router.push("/dashboard")
        return { success: true, data }
      }

      return { success: false, error: new Error("No session returned") }
    } catch (err) {
      console.error("Sign in error:", err)
      const error = err instanceof Error ? err : new Error("Unknown error during sign in")
      addToast(`Sign in failed: ${error.message}`, "error")
      return { success: false, error }
    } finally {
      setLoading(false)
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()

      if (error) {
        setAuthError(error)
        addToast(`Sign out failed: ${error.message}`, "error")
        return { success: false, error }
      }

      setSession(null)
      setUser(null)
      router.push("/login")
      return { success: true }
    } catch (err) {
      console.error("Sign out error:", err)
      const error = err instanceof Error ? err : new Error("Unknown error during sign out")
      addToast(`Sign out failed: ${error.message}`, "error")
      return { success: false, error }
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    session,
    loading,
    error: authError,
    signIn,
    signOut,
    isAuthenticated: !!user,
  }
}
