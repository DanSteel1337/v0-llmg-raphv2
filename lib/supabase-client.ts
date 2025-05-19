/**
 * Supabase Client
 *
 * Provides a singleton instance of the Supabase client for authentication.
 * This module ensures that only one connection to Supabase is maintained
 * throughout the application lifecycle.
 *
 * Dependencies:
 * - @supabase/auth-helpers-nextjs for Next.js integration
 * - Environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { SupabaseClient } from "@supabase/supabase-js"

// Singleton instance
let supabaseClient: SupabaseClient | null = null

/**
 * Get the Supabase client singleton for browser/client components
 */
export const getSupabaseBrowserClient = (): SupabaseClient => {
  if (!supabaseClient) {
    supabaseClient = createClientComponentClient()
  }
  return supabaseClient
}

/**
 * Reset the Supabase client singleton
 * Useful for testing or when environment variables change
 */
export const resetSupabaseClient = (): void => {
  supabaseClient = null
}
