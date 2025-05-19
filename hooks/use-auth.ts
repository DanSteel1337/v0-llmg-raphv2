/**
 * Auth Hook
 *
 * Custom hook for authentication functionality.
 *
 * Dependencies:
 * - @/services/auth-service for authentication operations
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  getCurrentUser,
  signInWithEmail as authSignInWithEmail,
  signUpWithEmail as authSignUpWithEmail,
  signOut as authSignOut,
  resetPassword as authResetPassword,
  updatePassword as authUpdatePassword,
} from "@/services/auth-service"
import type { User } from "@supabase/supabase-js"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadUser() {
      try {
        setIsLoading(true)
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (err) {
        console.error("Error in loadUser:", err)
        setError(err instanceof Error ? err.message : "Failed to load user")
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error } = await authSignInWithEmail(email, password)
      if (error) {
        setError(error.message)
        return { data: null, error }
      }
      setUser(data.user)
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign in"
      setError(errorMessage)
      return { data: null, error: { message: errorMessage } }
    } finally {
      setIsLoading(false)
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error } = await authSignUpWithEmail(email, password)
      if (error) {
        setError(error.message)
        return { data: null, error }
      }
      setUser(data.user)
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign up"
      setError(errorMessage)
      return { data: null, error: { message: errorMessage } }
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await authSignOut()
      setUser(null)
      router.push("/login")
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign out"
      setError(errorMessage)
      return { error: { message: errorMessage } }
    } finally {
      setIsLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error } = await authResetPassword(email)
      if (error) {
        setError(error.message)
        return { data: null, error }
      }
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to reset password"
      setError(errorMessage)
      return { data: null, error: { message: errorMessage } }
    } finally {
      setIsLoading(false)
    }
  }

  const updatePassword = async (password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error } = await authUpdatePassword(password)
      if (error) {
        setError(error.message)
        return { data: null, error }
      }
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update password"
      setError(errorMessage)
      return { data: null, error: { message: errorMessage } }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    user,
    isLoading,
    error,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    updatePassword,
  }
}
