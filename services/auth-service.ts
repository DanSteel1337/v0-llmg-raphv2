/**
 * Auth Service
 *
 * Handles authentication functionality using Supabase.
 * This service is responsible for user authentication operations including:
 * - Sign in/sign up
 * - Sign out
 * - User session management
 *
 * Dependencies:
 * - @/lib/supabase-client.ts for Supabase client singleton
 */

import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import type { User } from "@supabase/supabase-js"

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    console.error("Error getting user:", error)
    return null
  }

  return data.user
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signInWithPassword({ email, password })
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signUp({ email, password })
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signOut()
}

/**
 * Send a password reset email
 */
export async function resetPassword(email: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.resetPasswordForEmail(email)
}

/**
 * Update the current user's password
 */
export async function updatePassword(password: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.updateUser({ password })
}
