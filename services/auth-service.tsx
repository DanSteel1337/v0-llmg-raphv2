// Info: Authentication service using Supabase
"use client"

import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import type { User } from "@supabase/supabase-js"
import { useState, useEffect } from "react"

// Get the current user
export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    console.error("Error getting user:", error)
    return null
  }

  return data.user
}

// Hook to get the current user
export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    // Get initial user
    supabase.auth.getUser().then(
      ({ data, error }) => {
        if (error) {
          setError(error.message)
        } else {
          setUser(data.user)
        }
        setIsLoading(false)
      },
      (err) => {
        setError(err.message)
        setIsLoading(false)
      },
    )

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  return { user, isLoading, error }
}

// Sign in with email and password
export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signInWithPassword({ email, password })
}

// Sign up with email and password
export async function signUpWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signUp({ email, password })
}

// Sign out
export async function signOut() {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signOut()
}

// Reset password
export async function resetPassword(email: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.resetPasswordForEmail(email)
}

// Update password
export async function updatePassword(password: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.updateUser({ password })
}
